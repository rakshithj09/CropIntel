import CursorField from "@/components/CursorField";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Showcase from "@/components/Showcase";
import Stats from "@/components/Stats";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-bg">
      <CursorField />
      <Nav />
      <Hero />
      <HowItWorks />
      <Showcase />
      <Stats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
