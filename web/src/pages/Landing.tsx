import { useCallback, useState } from 'react';
import { Header } from '../components/Header';
import { Branches, Footer, Hero, HowItWorks, Services } from '../components/Sections';
import { BookingForm } from '../components/BookingForm';
import { ChatPopup } from '../components/ChatPopup';
import { Mascot } from '../components/Mascot';
import { AssistantProvider } from '../hooks/useAssistant';

const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function LandingInner() {
  const [preselect, setPreselect] = useState<{ service: string; nonce: number } | null>(null);

  const goBook = useCallback(() => {
    document.getElementById('book')?.scrollIntoView({ behavior: smooth() });
  }, []);
  const pick = useCallback((service: string) => {
    setPreselect({ service, nonce: Date.now() });
    goBook();
  }, [goBook]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero onBook={goBook} />
        <Services onPick={pick} />
        <section id="book" className="section book-section">
          <div className="container book-wrap">
            <div className="book-intro">
              <h2>Book your appointment</h2>
              <p className="lead-sm">Choose a service and date, pick an open time, and you are done. You get a booking reference straight away.</p>
              <ul className="check-list">
                <li>Open times shown live for the right branch</li>
                <li>No account or payment needed</li>
                <li>Printable proof of appointment</li>
              </ul>
            </div>
            <BookingForm preselect={preselect} />
          </div>
        </section>
        <HowItWorks />
        <Branches />
      </main>
      <Footer />
      <ChatPopup />
      <Mascot />
    </>
  );
}

export default function Landing() {
  return (
    <AssistantProvider>
      <LandingInner />
    </AssistantProvider>
  );
}
