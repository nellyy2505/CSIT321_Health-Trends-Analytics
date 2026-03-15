import Navbar from "../components/common/Navbar";
import Hero from "../components/landingPage/Hero";
import LandingFeatures from "../components/landingPage/LandingFeatures";
import LandingIndicators from "../components/landingPage/LandingIndicators";
import UploadDocument from "../components/landingPage/UploadDocument";
import WhyChooseUs from "../components/landingPage/WhyChooseUs";
import FormFilling from "../components/landingPage/FormFilling";
import Footer from "../components/common/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <LandingFeatures />
      <LandingIndicators />
      <WhyChooseUs />
      <UploadDocument />
      <FormFilling />
      <Footer />
    </>
  );
}
