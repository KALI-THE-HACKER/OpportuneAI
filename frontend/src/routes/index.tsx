import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  WordsPullUp,
  WordsPullUpMultiStyle,
  ScrollRevealText,
} from "@/components/shared/words-pull-up";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpportuneAI — The intelligence layer for your professional search" },
      {
        name: "description",
        content:
          "Direct access to the hidden job market. AI matching, skill-gap analysis, and an application tracker built for serious job seekers.",
      },
      {
        property: "og:title",
        content: "OpportuneAI — The intelligence layer for your professional search",
      },
      { property: "og:description", content: "AI-powered job discovery and application copilot." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isGridInView = useInView(gridRef, { once: true, margin: "-100px" });

  const aboutSegments = [
    { text: "We build OpportuneAI, ", className: "font-normal text-[#E1E0CC]" },
    { text: "an autonomous career agent. ", className: "italic font-serif text-[#E1E0CC]" },
    {
      text: "Engineered to automate job matching, highlight critical skill gaps, and track your applications privately.",
      className: "font-normal text-[#E1E0CC]",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-[#E1E0CC] flex flex-col relative select-none">
      {/* SECTION 1: HERO */}
      <section className="h-screen w-full p-4 md:p-6 bg-black relative flex flex-col box-border">
        <div className="flex-1 w-full relative rounded-2xl md:rounded-[2rem] overflow-hidden flex flex-col justify-between">
          {/* Background Video */}
          <video
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />

          {/* Noise Overlay */}
          <div className="absolute inset-0 noise-overlay opacity-[0.1] mix-blend-overlay pointer-events-none z-10" />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none z-10" />

          {/* Navbar */}
          <motion.nav
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-0 left-0 right-0 z-20 flex justify-center"
          >
            <div className="bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8 border-x border-b border-[#E1E0CC]/10 flex items-center gap-3 sm:gap-6 md:gap-12 lg:gap-14">
              <a
                href="#features"
                style={{ color: "rgba(225, 224, 204, 0.8)" }}
                className="text-[10px] sm:text-xs md:text-sm font-medium tracking-wide uppercase transition-colors hover:!text-[#E1E0CC]"
              >
                Features
              </a>
              <a
                href="#insights"
                style={{ color: "rgba(225, 224, 204, 0.8)" }}
                className="text-[10px] sm:text-xs md:text-sm font-medium tracking-wide uppercase transition-colors hover:!text-[#E1E0CC]"
              >
                Insights
              </a>
              <Link
                to="/auth/sign-in"
                style={{ color: "rgba(225, 224, 204, 0.8)" }}
                className="text-[10px] sm:text-xs md:text-sm font-medium tracking-wide uppercase transition-colors hover:!text-[#E1E0CC]"
              >
                Sign In
              </Link>
              <Link
                to="/auth/sign-up"
                style={{ color: "rgba(225, 224, 204, 0.8)" }}
                className="text-[10px] sm:text-xs md:text-sm font-medium tracking-wide uppercase transition-colors hover:!text-[#E1E0CC]"
              >
                Get Started
              </Link>
            </div>
          </motion.nav>

          {/* Hero Content (bottom-aligned) */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12 lg:p-16 z-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              {/* Giant Heading */}
              <div className="lg:col-span-8 flex justify-start">
                <WordsPullUp
                  text="OpportuneAI"
                  showAsterisk={true}
                  className="text-[16vw] sm:text-[14vw] md:text-[12vw] lg:text-[11vw] xl:text-[10vw] 2xl:text-[10.5vw] font-medium leading-[0.85] tracking-[-0.07em]"
                />
              </div>

              {/* Description + CTA */}
              <div className="lg:col-span-4 flex flex-col items-start gap-6 pb-6 lg:pb-8">
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-primary/70 text-xs sm:text-sm md:text-base leading-[1.2] text-left"
                >
                  OpportuneAI is the intelligence layer for your professional search. Direct gateway
                  to high-signal matching, automated skill-gap analysis, and private job pipeline
                  management designed for serious operators.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    to="/auth/sign-up"
                    className="group flex items-center justify-between gap-2 pl-6 pr-2 py-2 bg-primary text-black rounded-full font-medium text-sm sm:text-base transition-all duration-300 hover:gap-3 cursor-pointer shrink-0"
                  >
                    <span>Join the lab</span>
                    <div className="flex items-center justify-center bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:scale-110 shrink-0">
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ABOUT */}
      <section
        id="insights"
        className="bg-black py-24 px-6 flex justify-center items-center relative overflow-hidden"
      >
        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#DEDBC8]/5 blur-[120px] pointer-events-none z-0" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#101010] rounded-[2rem] w-full max-w-6xl p-8 sm:p-12 md:p-24 text-center relative z-10 overflow-hidden"
        >
          <span className="text-primary text-[10px] sm:text-xs uppercase tracking-widest block mb-6">
            Visual intelligence
          </span>

          <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-3xl mx-auto leading-[0.95] sm:leading-[0.9] text-center mb-12">
            <WordsPullUpMultiStyle segments={aboutSegments} />
          </div>

          <ScrollRevealText
            text="For the past decade, technical recruiting has been broken by noisy keywords and vanity filters. We built OpportuneAI to level the playing field, giving elite professionals an algorithmic advantage to match directly with high-signal roles."
            className="text-[#DEDBC8] text-xs sm:text-sm md:text-base max-w-2xl mx-auto text-center leading-relaxed mt-12"
          />
        </motion.div>
      </section>

      {/* SECTION 3: FEATURES */}
      <section
        id="features"
        className="min-h-screen bg-black py-24 px-6 relative flex flex-col justify-center overflow-hidden"
      >
        {/* Subtle background noise overlay */}
        <div className="absolute inset-0 bg-noise opacity-[0.15] pointer-events-none z-0" />

        {/* Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#DEDBC8]/5 blur-[140px] pointer-events-none z-0" />

        {/* Section Header */}
        <div className="text-center mb-16 relative z-10 flex flex-col gap-3">
          <WordsPullUp
            text="High-signal infrastructure for professional growth."
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal"
          />
          <WordsPullUp
            text="Built for serious operators. Powered by AI."
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal text-gray-500"
            delayOffset={0.4}
          />
        </div>

        {/* 4-Column Card Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-2 md:gap-1 lg:h-[480px] max-w-7xl mx-auto w-full px-4 relative z-10"
        >
          {/* Card 1 - Video Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isGridInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, delay: 0 * 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="h-full relative rounded-2xl overflow-hidden group aspect-[3/4] md:aspect-auto"
          >
            <video
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-6 left-6 text-left z-20">
              <span className="text-lg sm:text-xl font-medium" style={{ color: "#E1E0CC" }}>
                Your private career agent.
              </span>
            </div>
          </motion.div>

          {/* Card 2 - AI-Ranked Matches */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isGridInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, delay: 1 * 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#212121] rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full text-left"
          >
            <div>
              <img
                src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85"
                alt="AI-Ranked Matches Icon"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover mb-6"
              />
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="text-lg sm:text-xl font-medium" style={{ color: "#E1E0CC" }}>
                  AI-Ranked Matches.
                </h3>
                <span className="text-xs text-gray-500 font-mono">01</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Direct match strength scoring",
                  "Real-time market signal extraction",
                  "Calibrated salary estimations",
                  "Resume-to-role vector alignment",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/auth/sign-up"
              style={{ color: "#E1E0CC" }}
              className="flex items-center gap-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity mt-6 group/link w-fit"
            >
              <span>Learn more</span>
              <ArrowRight className="w-3.5 h-3.5 transform -rotate-45 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </Link>
          </motion.div>

          {/* Card 3 - Skill-Gap Analytics */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isGridInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, delay: 2 * 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#212121] rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full text-left"
          >
            <div>
              <img
                src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85"
                alt="Skill-Gap Analytics Icon"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover mb-6"
              />
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="text-lg sm:text-xl font-medium" style={{ color: "#E1E0CC" }}>
                  Skill-Gap Analytics.
                </h3>
                <span className="text-xs text-gray-500 font-mono">02</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Targeted learning recommendations",
                  "Resume optimization directives",
                  "Core capability index analysis",
                  "Level calibrations",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/auth/sign-up"
              style={{ color: "#E1E0CC" }}
              className="flex items-center gap-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity mt-6 group/link w-fit"
            >
              <span>Learn more</span>
              <ArrowRight className="w-3.5 h-3.5 transform -rotate-45 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </Link>
          </motion.div>

          {/* Card 4 - Application Tracker */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isGridInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, delay: 3 * 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="bg-[#212121] rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full text-left"
          >
            <div>
              <img
                src="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85"
                alt="Application Tracker Icon"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover mb-6"
              />
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="text-lg sm:text-xl font-medium" style={{ color: "#E1E0CC" }}>
                  Application Tracker.
                </h3>
                <span className="text-xs text-gray-500 font-mono">03</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Private job pipeline management",
                  "Follow-up schedule automation",
                  "Privacy-first applicant profiles",
                  "Sync status events",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/auth/sign-up"
              style={{ color: "#E1E0CC" }}
              className="flex items-center gap-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity mt-6 group/link w-fit"
            >
              <span>Learn more</span>
              <ArrowRight className="w-3.5 h-3.5 transform -rotate-45 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-[#E1E0CC]/10 bg-black relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-wider" style={{ color: "#E1E0CC" }}>
              OPPORTUNEAI
            </span>
            <nav className="flex gap-4 text-xs font-medium text-gray-500">
              <a href="#" className="hover:text-[#E1E0CC] transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-[#E1E0CC] transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-[#E1E0CC] transition-colors">
                Security
              </a>
            </nav>
          </div>
          <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
            © 2026 LUCKYLINUX · All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
