import LegalPage from "../components/LegalPage";

export default function DmcaPage() {
  return (
    <LegalPage
      title="DMCA / Copyright Policy"
      description="How copyright holders can submit takedown requests to AddNovel under the DMCA."
      path="/dmca"
    >
      <p>
        AddNovel respects the intellectual property rights of others and expects users of our platform to
        do the same. We respond to clear notices of alleged copyright infringement in accordance with the
        Digital Millennium Copyright Act (DMCA) and applicable copyright laws.
      </p>

      <h2>Copyright Ownership</h2>
      <p>
        All content hosted on AddNovel, including novel text, covers, and other materials, is the property
        of its respective authors and rights holders. We do not claim ownership of user-submitted or
        third-party content. If you are a rights holder and believe any content on this site infringes your
        copyright, you may submit a takedown request as described below.
      </p>

      <h2>Submitting a Takedown Request</h2>
      <p>
        To file a DMCA notice, please send an email to{" "}
        <a href="mailto:dmca@addnovel.com">dmca@addnovel.com</a> containing the following
        information:
      </p>
      <ul>
        <li>A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</li>
        <li>Identification of the copyrighted work you claim has been infringed.</li>
        <li>Identification of the specific URL(s) or content on AddNovel that you believe is infringing.</li>
        <li>Your contact information, including your full name, mailing address, email address, and telephone number.</li>
        <li>A statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
        <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner's behalf.</li>
      </ul>

      <h2>Response Time</h2>
      <p>
        We review and process valid DMCA notices within 1 to 2 business days. Infringing material will be
        removed or access will be disabled promptly upon receiving a valid notice.
      </p>

      <h2>Counter-Notification</h2>
      <p>
        If you believe your content was removed in error, you may submit a counter-notification to{" "}
        <a href="mailto:dmca@addnovel.com">dmca@addnovel.com</a> that includes:
      </p>
      <ul>
        <li>Your physical or electronic signature.</li>
        <li>Identification of the material that was removed and the location where it appeared.</li>
        <li>A statement under penalty of perjury that you have a good-faith belief the material was removed or disabled as a result of mistake or misidentification.</li>
        <li>Your name, address, telephone number, and email address.</li>
        <li>A statement that you consent to the jurisdiction of the federal court in your district (or, if outside the United States, an appropriate jurisdiction).</li>
      </ul>

      <h2>Repeat Infringers</h2>
      <p>
        We will terminate access for users who are determined to be repeat infringers in accordance with
        applicable law.
      </p>

      <h2>Contact</h2>
      <p>
        For any copyright-related questions, please contact us at{" "}
        <a href="mailto:copyright@addnovel.com">copyright@addnovel.com</a>.
      </p>
    </LegalPage>
  );
}
