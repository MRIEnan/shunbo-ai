//! Meeting audio capture: microphone + system output (WASAPI loopback on Windows).
//! Both tracks are downmixed to mono, resampled to 16 kHz and buffered as i16 PCM.
//! The frontend drains each track periodically (`meeting_capture_take`) and uploads WAV chunks.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const TARGET_RATE: u32 = 16_000;

#[derive(Default)]
pub struct Track {
    buf: Mutex<Vec<i16>>,
    level: AtomicU32, // f32 bits, RMS of the last callback
}

impl Track {
    fn push(&self, samples: &[f32]) {
        let mut sum = 0f32;
        let mut buf = self.buf.lock().unwrap();
        buf.reserve(samples.len());
        for &s in samples {
            sum += s * s;
            buf.push((s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16);
        }
        let rms = if samples.is_empty() { 0.0 } else { (sum / samples.len() as f32).sqrt() };
        self.level.store((rms * 4.0).min(1.0).to_bits(), Ordering::Relaxed);
    }
    fn take(&self) -> Vec<i16> {
        std::mem::take(&mut *self.buf.lock().unwrap())
    }
    fn level(&self) -> f32 {
        f32::from_bits(self.level.load(Ordering::Relaxed))
    }
}

pub struct Session {
    mic: Arc<Track>,
    system: Arc<Track>,
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    handles: Vec<JoinHandle<()>>,
    started: Instant,
}

/// WASAPI loopback only delivers buffers while something is rendering. Playing silence on the
/// same device keeps the loopback callbacks flowing, so gaps between speech keep real timing.
fn spawn_keepalive(device: cpal::Device, stop: Arc<AtomicBool>) -> Result<JoinHandle<()>, String> {
    let config = device.default_output_config().map_err(|e| format!("No output config: {e}"))?;
    let stream_config: cpal::StreamConfig = config.into();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let handle = std::thread::spawn(move || {
        let built = device.build_output_stream(
            &stream_config,
            move |data: &mut [f32], _| data.iter_mut().for_each(|s| *s = 0.0),
            |e| eprintln!("[capture] keepalive error: {e}"),
            None,
        );
        let stream = match built {
            Ok(s) => s,
            Err(e) => {
                let _ = tx.send(Err(format!("Couldn't open silent output stream: {e}")));
                return;
            }
        };
        if let Err(e) = stream.play() {
            let _ = tx.send(Err(e.to_string()));
            return;
        }
        let _ = tx.send(Ok(()));
        while !stop.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(50));
        }
        drop(stream);
    });
    match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(handle),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("Timed out opening output device".into()),
    }
}

#[derive(Default)]
pub struct CaptureState(pub Mutex<Option<Session>>);

#[derive(serde::Serialize)]
pub struct CaptureInfo {
    pub mic: String,
    pub system: String,
}

/// Streams one device into `track`. `loopback` means "capture what this output device is playing".
fn spawn(
    device: cpal::Device,
    loopback: bool,
    track: Arc<Track>,
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
) -> Result<JoinHandle<()>, String> {
    let config = if loopback { device.default_output_config() } else { device.default_input_config() }
        .map_err(|e| format!("No default config: {e}"))?;
    let format = config.sample_format();
    let stream_config: cpal::StreamConfig = config.into();
    let channels = stream_config.channels as usize;
    let in_rate = stream_config.sample_rate.0 as f64;
    let ratio = in_rate / TARGET_RATE as f64;

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();

    let handle = std::thread::spawn(move || {
        let mut pending: Vec<f32> = Vec::new(); // input samples not yet consumed by the resampler
        let mut pos = 0f64; // fractional read position inside `pending`
        let paused_cb = paused.clone();
        let track_cb = track.clone();

        // Downmix happens in the callbacks; here we resample with linear interpolation.
        let mut process = move |mono: &[f32]| {
            if paused_cb.load(Ordering::Relaxed) {
                return;
            }
            pending.extend_from_slice(mono);
            let mut out = Vec::with_capacity((mono.len() as f64 / ratio) as usize + 2);
            while (pos as usize) + 1 < pending.len() {
                let i = pos as usize;
                let frac = (pos - i as f64) as f32;
                out.push(pending[i] * (1.0 - frac) + pending[i + 1] * frac);
                pos += ratio;
            }
            let consumed = (pos as usize).min(pending.len());
            pending.drain(..consumed);
            pos -= consumed as f64;
            track_cb.push(&out);
        };

        let err_fn = |e| eprintln!("[capture] stream error: {e}");
        let built = match format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    let mono: Vec<f32> = data.chunks(channels).map(|f| f.iter().sum::<f32>() / channels as f32).collect();
                    process(&mono);
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    let mono: Vec<f32> = data
                        .chunks(channels)
                        .map(|f| f.iter().map(|&s| s as f32 / i16::MAX as f32).sum::<f32>() / channels as f32)
                        .collect();
                    process(&mono);
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    let mono: Vec<f32> = data
                        .chunks(channels)
                        .map(|f| f.iter().map(|&s| (s as f32 - 32768.0) / 32768.0).sum::<f32>() / channels as f32)
                        .collect();
                    process(&mono);
                },
                err_fn,
                None,
            ),
            other => Err(cpal::BuildStreamError::BackendSpecific {
                err: cpal::BackendSpecificError { description: format!("unsupported sample format {other:?}") },
            }),
        };
        let stream = match built {
            Ok(s) => s,
            Err(e) => {
                let _ = tx.send(Err(format!("Couldn't open audio stream: {e}")));
                return;
            }
        };
        if let Err(e) = stream.play() {
            let _ = tx.send(Err(format!("Couldn't start audio stream: {e}")));
            return;
        }
        let _ = tx.send(Ok(()));
        while !stop.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(50));
        }
        drop(stream);
    });

    match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => Ok(handle),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("Timed out opening audio device".into()),
    }
}

impl Session {
    /// Opens the default microphone and the default output device (loopback) and starts capturing.
    pub fn start() -> Result<(Session, CaptureInfo), String> {
        let host = cpal::default_host();
    let mic_dev = host.default_input_device().ok_or("No microphone found")?;
    let out_dev = host.default_output_device().ok_or("No speaker/output device found")?;
    let mic_name = mic_dev.name().unwrap_or_else(|_| "Microphone".into());
    let out_name = out_dev.name().unwrap_or_else(|_| "System audio".into());

    let stop = Arc::new(AtomicBool::new(false));
    let paused = Arc::new(AtomicBool::new(false));
    let mic = Arc::new(Track::default());
    let system = Arc::new(Track::default());

    let keepalive_dev = host.default_output_device().ok_or("No speaker/output device found")?;
    let h1 = spawn(mic_dev, false, mic.clone(), stop.clone(), paused.clone())?;
    let h2 = match spawn(out_dev, true, system.clone(), stop.clone(), paused.clone()) {
        Ok(h) => h,
        Err(e) => {
            stop.store(true, Ordering::Relaxed);
            let _ = h1.join();
            return Err(format!("{e} (system audio loopback)"));
        }
    };
    let h3 = match spawn_keepalive(keepalive_dev, stop.clone()) {
        Ok(h) => h,
        Err(e) => {
            stop.store(true, Ordering::Relaxed);
            let _ = h1.join();
            let _ = h2.join();
            return Err(e);
        }
    };

        Ok((Session { mic, system, stop, paused, handles: vec![h1, h2, h3], started: Instant::now() }, CaptureInfo { mic: mic_name, system: out_name }))
    }

    pub fn take(&self, track: &str) -> Vec<i16> {
        if track == "system" { self.system.take() } else { self.mic.take() }
    }

    pub fn stop(self) {
        self.stop.store(true, Ordering::Relaxed);
        for h in self.handles {
            let _ = h.join();
        }
    }
}

#[tauri::command]
pub fn meeting_capture_start(state: tauri::State<'_, CaptureState>) -> Result<CaptureInfo, String> {
    let mut guard = state.0.lock().unwrap();
    if guard.is_some() {
        return Err("A meeting is already being recorded".into());
    }
    let (session, info) = Session::start()?;
    *guard = Some(session);
    Ok(info)
}

#[tauri::command]
pub fn meeting_capture_pause(state: tauri::State<'_, CaptureState>, paused: bool) -> Result<(), String> {
    let guard = state.0.lock().unwrap();
    let s = guard.as_ref().ok_or("Not recording")?;
    s.paused.store(paused, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn meeting_capture_levels(state: tauri::State<'_, CaptureState>) -> (f32, f32, f64) {
    let guard = state.0.lock().unwrap();
    match guard.as_ref() {
        Some(s) => (s.mic.level(), s.system.level(), s.started.elapsed().as_secs_f64()),
        None => (0.0, 0.0, 0.0),
    }
}

/// Drains one track and returns it as a 16 kHz mono 16-bit WAV file.
#[tauri::command]
pub fn meeting_capture_take(state: tauri::State<'_, CaptureState>, track: String) -> Result<tauri::ipc::Response, String> {
    let guard = state.0.lock().unwrap();
    let s = guard.as_ref().ok_or("Not recording")?;
    Ok(tauri::ipc::Response::new(wav(&s.take(&track))))
}

#[tauri::command]
pub fn meeting_capture_stop(state: tauri::State<'_, CaptureState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(s) = guard.take() {
        s.stop();
    }
    Ok(())
}

pub fn wav(samples: &[i16]) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let mut out = Vec::with_capacity(44 + data_len as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_len).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes()); // PCM
    out.extend_from_slice(&1u16.to_le_bytes()); // mono
    out.extend_from_slice(&TARGET_RATE.to_le_bytes());
    out.extend_from_slice(&(TARGET_RATE * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        out.extend_from_slice(&s.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Needs real audio devices; run locally with `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn captures_both_tracks_at_16k() {
        let (session, info) = Session::start().expect("start capture");
        eprintln!("mic={} system={}", info.mic, info.system);
        // Play a quiet 440 Hz tone so the loopback track carries a real signal.
        let host = cpal::default_host();
        let out = host.default_output_device().unwrap();
        let cfg: cpal::StreamConfig = out.default_output_config().unwrap().into();
        let rate = cfg.sample_rate.0 as f32;
        let ch = cfg.channels as usize;
        let mut phase = 0f32;
        let tone = out
            .build_output_stream(
                &cfg,
                move |data: &mut [f32], _| {
                    for frame in data.chunks_mut(ch) {
                        let v = (phase * 2.0 * std::f32::consts::PI).sin() * 0.1;
                        phase = (phase + 440.0 / rate) % 1.0;
                        frame.iter_mut().for_each(|s| *s = v);
                    }
                },
                |e| eprintln!("tone error {e}"),
                None,
            )
            .unwrap();
        tone.play().unwrap();
        std::thread::sleep(Duration::from_secs(3));
        drop(tone);
        let mic = session.take("mic");
        let system = session.take("system");
        session.stop();
        eprintln!("mic samples={} ({:.2}s) system samples={} ({:.2}s)", mic.len(), mic.len() as f64 / 16000.0, system.len(), system.len() as f64 / 16000.0);
        // Resampler should produce roughly 3 s of 16 kHz audio per track (allow for callback latency).
        assert!(mic.len() > 16000 * 2 && mic.len() < 16000 * 4, "mic sample count out of range: {}", mic.len());
        assert!(system.len() > 16000 * 2 && system.len() < 16000 * 4, "system sample count out of range: {}", system.len());
        let rms = (system.iter().map(|&x| (x as f64 / 32768.0).powi(2)).sum::<f64>() / system.len().max(1) as f64).sqrt();
        eprintln!("system rms={rms:.4}");
        assert!(rms > 0.01, "loopback track is silent (rms {rms:.4})");
        let w = wav(&mic);
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(w.len(), 44 + mic.len() * 2);
    }
}
