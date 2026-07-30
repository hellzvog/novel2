import { Mail, Briefcase, ShieldAlert, FileWarning } from "lucide-react";
import LegalPage from "../components/LegalPage";

export default function ContactPage() {
  const cards = [
    {
      icon: Mail,
      title: "General Inquiries",
      email: "hello@lumennovel.example",
      desc: "Questions, feedback, or suggestions about the platform or any novel.",
    },
    {
      icon: Briefcase,
      title: "Business Inquiries",
      email: "business@lumennovel.example",
      desc: "Partnerships, advertising, or other commercial opportunities.",
    },
    {
      icon: ShieldAlert,
      title: "Copyright Requests",
      email: "copyright@lumennovel.example",
      desc: "Permission requests or questions about copyrighted material.",
    },
    {
      icon: FileWarning,
      title: "DMCA / Takedown Requests",
      email: "dmca@lumennovel.example",
      desc: "Formal takedown notices under the DMCA. Please include the details listed on our DMCA page.",
    },
  ];

  return (
    <LegalPage
      title="Contact"
      description="Get in touch with LumenNovel for general inquiries, business, copyright, and DMCA requests."
      path="/contact"
    >
      <p>
        We welcome your questions, feedback, and requests. Please reach out using the appropriate email
        address below so we can direct your message to the right team.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <c.icon className="mb-2 text-amber-500" size={20} />
            <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">{c.title}</h3>
            <p className="mt-1 text-sm">{c.desc}</p>
            <a href={`mailto:${c.email}`} className="mt-2 inline-block text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400">
              {c.email}
            </a>
          </div>
        ))}
      </div>

      <h2>Response Time</h2>
      <p>
        We aim to respond to all legitimate inquiries within 3 business days. DMCA and copyright takedown
        requests are prioritized and typically handled within 1 to 2 business days. Please make sure your
        message includes enough detail for us to identify the relevant content or issue.
      </p>

      <h2>Mailing Address</h2>
      <p>
        LumenNovel<br />
        [Street Address]<br />
        [City, State / Province, Postal Code]<br />
        [Country]
      </p>
    </LegalPage>
  );
}
