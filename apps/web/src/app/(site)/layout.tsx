import { AnnouncementBar, Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

/** Marketing pages share one header and footer, so the nav (and its toggle animation) persists across navigation. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Nav />
      {children}
      <Footer />
    </>
  );
}
