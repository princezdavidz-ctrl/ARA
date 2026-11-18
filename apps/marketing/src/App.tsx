import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Channels from './components/Channels';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-950">
      <Navbar />
      <main>
        <Hero />
        <Channels />
        <Features />
        <HowItWorks />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
