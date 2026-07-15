"use client";
import Image from "next/image";
import Link from "next/link";

export const StudyModesSection = () => {
  return (
    <main className="flex flex-col items-center justify-start py-10 text-black px-4">
      <h1 className="text-5xl md:text-5xl font-bold text-center mb-4">
        How do you want to study?
      </h1>

      <p className="text-center text-lg md:text-xl max-w-2xl mb-8">
        Master whatever you’re learning with Imba Learn’s interactive
        flashcards, practice tests and study activities.
      </p>

      <div className=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-16 w-full px-8">
        {[
          { src: "/images/img1.png", label: "Learn", bg: "#98E3FF" },
          { src: "/images/img2.png", label: "Study guides", bg: "#423ED8" },
          { src: "/images/img3.png", label: "Flashcards", bg: "#FFCD1F" },
          { src: "/images/img4.png", label: "Practice tests", bg: "#FDD2CA" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="relative rounded-2xl overflow-hidden shadow-md aspect-4/3 cursor-pointer transform transition-transform duration-300 hover:scale-105 hover:shadow-xl"
            style={{
              backgroundColor: item.bg,
              height: "300px",
              width: "100%",
            }}
          >
            <Image
              src={item.src}
              alt={item.label}
              className="absolute bottom-4 right-4 w-[250px] object-cover"
              width={250}
              height={250}
            />
            <span className="absolute top-4 left-4 text-black text-lg font-semibold">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
};
