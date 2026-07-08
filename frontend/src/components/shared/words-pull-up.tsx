import { useRef } from "react";
import { motion, useInView, useScroll, useTransform, MotionValue } from "framer-motion";

interface Segment {
  text: string;
  className?: string;
}

export function WordsPullUp({
  text,
  className = "",
  showAsterisk = false,
  delayOffset = 0,
}: {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  delayOffset?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <span ref={ref} className={`inline-flex flex-wrap justify-center ${className}`}>
      {words.map((word, idx) => {
        const isLastWord = idx === words.length - 1;
        return (
          <motion.span
            key={idx}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{
              duration: 0.8,
              delay: delayOffset + idx * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="inline-block relative mr-[0.25em] last:mr-0"
          >
            {isLastWord && showAsterisk ? (
              <span className="relative inline-block pr-[0.3em]">
                {word.endsWith("a") ? word.slice(0, -1) : word}
                <span>{word.endsWith("a") ? "a" : ""}</span>
                <sup className="absolute top-[0.65em] -right-[0.1em] text-[0.31em] font-normal">
                  *
                </sup>
              </span>
            ) : (
              word
            )}
          </motion.span>
        );
      })}
    </span>
  );
}

export function WordsPullUpMultiStyle({
  segments,
  className = "",
  delayOffset = 0,
}: {
  segments: Segment[];
  className?: string;
  delayOffset?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  const allWords: { word: string; className: string }[] = [];
  segments.forEach((seg) => {
    const words = seg.text.split(" ");
    words.forEach((w) => {
      allWords.push({ word: w, className: seg.className || "" });
    });
  });

  return (
    <span ref={ref} className={`inline-flex flex-wrap justify-center ${className}`}>
      {allWords.map((item, idx) => (
        <motion.span
          key={idx}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{
            duration: 0.8,
            delay: delayOffset + idx * 0.08,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={`inline-block mr-[0.25em] last:mr-0 ${item.className}`}
        >
          {item.word}
        </motion.span>
      ))}
    </span>
  );
}

export function AnimatedLetter({
  character,
  index,
  totalChars,
  progress,
}: {
  character: string;
  index: number;
  totalChars: number;
  progress: MotionValue<number>;
}) {
  const charProgress = index / totalChars;
  const start = charProgress - 0.1;
  const end = charProgress + 0.05;

  const opacity = useTransform(progress, [start, end], [0.2, 1]);

  return <motion.span style={{ opacity }}>{character}</motion.span>;
}

export function ScrollRevealText({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.2"],
  });

  const characters = text.split("");
  const totalChars = characters.length;

  return (
    <p ref={containerRef} className={className}>
      {characters.map((char, idx) => (
        <AnimatedLetter
          key={idx}
          character={char}
          index={idx}
          totalChars={totalChars}
          progress={scrollYProgress}
        />
      ))}
    </p>
  );
}
