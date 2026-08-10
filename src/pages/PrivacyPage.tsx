import LegalPage from "../components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How AddNovel handles cookies, analytics, local storage, advertising, and third-party services."
      path="/privacy"
    >
      <p>
        This Privacy Policy explains how AddNovel ("we", "us", or "our") collects, uses, and protects
        information when you visit our website. We are committed to being transparent about what data we
        process and to giving you meaningful control over your privacy.
      </p>

      <h2>Information We Collect</h2>
      <p>
        AddNovel is designed to work with minimal personal data. The information we may process includes:
      </p>
      <ul>
        <li><strong>Browser information:</strong> browser type, version, language, and operating system, collected automatically when you visit.</li>
        <li><strong>Usage data:</strong> pages visited, time spent, referring URLs, and approximate region (derived from IP address).</li>
        <li><strong>Local storage data:</strong> your reading position, favorites, theme preference, and other settings stored directly in your browser.</li>
        <li><strong>Information you provide:</strong> any details you include when contacting us by email.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies and similar technologies to keep the site working and to understand how it is used.
        Cookies are small text files stored on your device. We use:
      </p>
      <ul>
        <li><strong>Essential cookies:</strong> required for core site functionality such as saving your theme and reading progress.</li>
        <li><strong>Analytics cookies:</strong> help us understand which pages and features are used most so we can improve them.</li>
        <li><strong>Advertising cookies:</strong> used by third-party advertising partners, including Google AdSense, to serve relevant ads.</li>
      </ul>
      <p>
        You can control or delete cookies through your browser settings. Disabling some cookies may affect
        how the site functions.
      </p>

      <h2>Local Storage and User Preferences</h2>
      <p>
        To preserve your experience across visits, AddNovel stores your reading position, favorites list,
        theme choice (light or dark), and other preferences in your browser's local storage. This data never
        leaves your device and is not shared with us or any third party. You can clear it at any time by
        clearing your browser data.
      </p>

      <h2>Analytics</h2>
      <p>
        We may use analytics services to collect aggregated, anonymized information about how visitors use
        the site. This helps us understand traffic patterns and improve content and performance. Analytics
        providers may set their own cookies and process limited usage data in accordance with their own
        privacy policies.
      </p>

      <h2>Google AdSense and Third-Party Advertising</h2>
      <p>
        We may display ads served by Google AdSense or similar advertising networks. These providers may use
        cookies and device identifiers to serve ads based on your prior visits to this and other websites.
      </p>
      <ul>
        <li>Google's use of advertising cookies enables it and its partners to serve ads based on your visits.</li>
        <li>You can opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads">Google Ads Settings</a>.</li>
        <li>For more information, see <a href="https://policies.google.com/technologies/ads">how Google uses data when you use partner sites</a>.</li>
      </ul>
      <p>
        Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to our
        website or other websites. This usage of advertising cookies allows Google and its partners to
        display ads based on your interests.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        We rely on third-party services for hosting, analytics, advertising, and content delivery. These
        providers may collect limited information as governed by their own privacy policies. We do not share
        personal data with them beyond what is necessary to operate the site.
      </p>

      <h2>How We Use Information</h2>
      <ul>
        <li>To operate, maintain, and improve the website.</li>
        <li>To analyze usage and understand which content is popular.</li>
        <li>To respond to your inquiries and enforce our policies.</li>
        <li>To display relevant advertising where applicable.</li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        Local storage data remains on your device until you clear it. Server-side analytics and log data are
        retained only as long as necessary for the purposes described in this policy.
      </p>

      <h2>Your Choices</h2>
      <ul>
        <li>Clear cookies and local storage through your browser settings.</li>
        <li>Opt out of personalized advertising via your browser or Google Ads Settings.</li>
        <li>Contact us to request information about or deletion of any data you have provided directly.</li>
      </ul>

      <h2>Children's Privacy</h2>
      <p>
        AddNovel is not directed at children under 13, and we do not knowingly collect personal
        information from children. If you believe a child has provided us with personal data, please contact
        us and we will take steps to delete it.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating
        the "Last updated" date at the top of this page.
      </p>

      <h2>Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please email{" "}
        <a href="mailto:contactus@addnovel.com">contactus@addnovel.com</a>.
      </p>
    </LegalPage>
  );
}
