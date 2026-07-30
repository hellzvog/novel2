import { BookOpen, Mail, Clock, Shield, RefreshCw, FileText } from "lucide-react";
import LegalPage from "../components/LegalPage";

export default function AboutPage() {
  return (
    <LegalPage
      title="About Us"
      description="Learn about LumenNovel, a clean online English web novel reading platform for serialized fiction."
      path="/about"
    >
      <p>
        LumenNovel is an online English web novel reading platform dedicated to bringing readers a clean,
        modern, and distraction-free environment for discovering and enjoying serialized fiction. Our goal
        is to make every chapter easy to find, easy to read, and pleasant to return to.
      </p>

      <h2>Our Purpose</h2>
      <p>
        We built LumenNovel to give readers a single, organized home for web novels. Whether you follow an
        ongoing series or prefer to binge a completed story, the platform is designed to help you find your
        next read by genre, status, and popularity, and to keep your place across chapters.
      </p>

      <h2>The Reading Experience</h2>
      <p>
        Every novel page presents the cover, title, author, synopsis, genres, status, and chapter list so
        you can decide what to read at a glance. The built-in reader is optimized for long-form text, with a
        clean layout, comfortable typography, and a dark mode for nighttime reading. Your reading position
        and favorites are saved locally on your device, so you can pick up exactly where you left off.
      </p>

      <h2>Regular Updates</h2>
      <p>
        New chapters are added on a regular schedule. The home page highlights recently updated novels and
        trending titles, and each novel page shows the latest chapter so you can quickly see what is new.
      </p>

      <h2>Respect for Copyright</h2>
      <p>
        We take copyright seriously. LumenNovel respects the rights of authors and rights holders, and we
        provide a clear process for submitting takedown requests. If you believe any content hosted here
        infringes your rights, please see our <a href="/dmca">DMCA / Copyright Policy</a> page for
        instructions on how to submit a notice.
      </p>

      <h2>Get in Touch</h2>
      <p>
        Questions, feedback, and partnership inquiries are welcome. Visit our <a href="/contact">Contact</a>
        page for the appropriate email address, or write to us at{" "}
        <a href="mailto:hello@lumennovel.example">hello@lumennovel.example</a>.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <BookOpen className="mb-2 text-amber-500" size={20} />
          <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">Read Anywhere</h3>
          <p className="text-sm">A responsive reader that works on phones, tablets, and desktops.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <RefreshCw className="mb-2 text-amber-500" size={20} />
          <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">Regular Updates</h3>
          <p className="text-sm">New chapters are added regularly across ongoing series.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <Shield className="mb-2 text-amber-500" size={20} />
          <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">Copyright Respect</h3>
          <p className="text-sm">A clear DMCA process for rights holders to request removals.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <FileText className="mb-2 text-amber-500" size={20} />
          <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">Clear Policies</h3>
          <p className="text-sm">Public Privacy Policy and Terms of Service for transparency.</p>
        </div>
      </div>
    </LegalPage>
  );
}
