import LegalPage from "../components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The terms and conditions for using AddNovel, including usage rules, intellectual property, and liability."
      path="/terms"
    >
      <p>
        These Terms of Service ("Terms") govern your use of the AddNovel website (the "Service"). By
        accessing or using the Service, you agree to be bound by these Terms. If you do not agree, please do
        not use the Service.
      </p>

      <h2>Website Usage</h2>
      <p>
        AddNovel provides a free online platform for reading serialized web novels. You may browse,
        read, and save novels to your favorites for personal, non-commercial use. The Service is provided
        "as is" and may be modified or discontinued at any time without notice.
      </p>

      <h2>User Responsibilities</h2>
      <p>By using AddNovel, you agree to:</p>
      <ul>
        <li>Use the Service only for lawful purposes and in a way that does not infringe the rights of others.</li>
        <li>Not attempt to disrupt, overload, or gain unauthorized access to the Service or its infrastructure.</li>
        <li>Not scrape, copy, or redistribute content from the Service without permission from the rights holder.</li>
        <li>Not introduce viruses, malware, or any other malicious code.</li>
        <li>Respect the intellectual property rights of authors and other contributors.</li>
      </ul>

      <h2>Intellectual Property</h2>
      <p>
        All content on AddNovel, including text, covers, logos, and design, is owned by AddNovel or its
        licensors and is protected by copyright and other intellectual property laws. Novel content remains
        the property of its respective authors and rights holders. You may not reproduce, republish, or
        distribute any content without prior written permission.
      </p>
      <p>
        If you believe any content infringes your copyright, please submit a notice as described on our{" "}
        <a href="/dmca">DMCA / Copyright Policy</a> page.
      </p>

      <h2>Availability</h2>
      <p>
        We strive to keep the Service available but do not guarantee uninterrupted access. The Service may
        be temporarily unavailable due to maintenance, updates, or factors outside our control. We are not
        liable for any downtime or data loss resulting from such interruptions.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, AddNovel and its operators shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages arising from your use of, or
        inability to use, the Service. We do not warrant that the Service will be error-free, secure, or
        available at all times.
      </p>

      <h2>Third-Party Links and Advertising</h2>
      <p>
        The Service may contain links to third-party websites and display advertising from third-party
        networks. We are not responsible for the content, policies, or practices of any third-party site or
        advertiser. Accessing third-party sites is at your own risk.
      </p>

      <h2>Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service after changes are posted
        constitutes acceptance of the revised Terms. The "Last updated" date at the top of this page
        indicates when the Terms were last revised.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:contactus@addnovel.com">contactus@addnovel.com</a>.
      </p>
    </LegalPage>
  );
}
