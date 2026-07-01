import Image from "next/image";
import { PublicNav } from "@/components/public-nav";

const facultyProfile =
  "Dr Emmanuel Abu has vast amounts of local and international experience in clinical laboratory medicine spanning over 20 years in large tertiary hospitals and in modest medical centres. Whilst in the UK, he developed a similar online interactive teaching program that was accredited by the Royal College of General Practitioners. He holds an MSc in Clinical Biochemistry with distinction from the University of Surrey, UK, a PhD from St. John's College, University of Cambridge, UK. He is a Fellow of the Royal College of Physicians and Pathologists, UK. He also holds a PGCert in Medical Education from the University of Warrick, UK, PGCert in Hospital and Social care management, Henley Business school, University of Reading UK and an advanced diploma in forensic medical sciences awarded by the Society of Apothecaries of London, UK. He has been involved in teaching and training of biomedical and clinical scientists and postgraduate medical doctors. He is passionate about impacting knowledge that matters in the provision of quality care to patients.";

export default function FacultyPage() {
  return (
    <main className="min-h-screen bg-app-canvas text-primary-text">
      <PublicNav activePage="faculty" />

      <section className="mx-auto grid w-full max-w-6xl items-start gap-12 px-6 py-16 md:grid-cols-[0.95fr_0.9fr] lg:py-24">
        <div className="relative aspect-square overflow-hidden rounded">
          <Image
            src="/images/medstaff.jpg"
            alt="Faculty profile"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 44vw, 100vw"
          />
        </div>

        <div className="pt-2">
          <h1
            className="text-3xl font-bold leading-tight md:text-4xl"
            data-testid="faculty-heading"
          >
            Faculty Profile
          </h1>
          <p
            className="mt-6 text-base leading-8 text-muted-gray md:text-lg md:leading-9"
            data-testid="faculty-profile-copy"
          >
            {facultyProfile}
          </p>
        </div>
      </section>
    </main>
  );
}
