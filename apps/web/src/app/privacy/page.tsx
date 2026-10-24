import Link from "next/link";
export default function Page() {
  return (
    <main className="privacy">
      <Link href="/explore">← Back to ATL / Out</Link>
      <h1>Your data, simply.</h1>
      <h2>Account and plans</h2>
      <p>
        We store your email, securely hashed password if you use one, sign-in
        identity, saved activities, reminders and activity conversations. You
        can delete your account in Settings, which removes personal account data
        and cancels pending reminders.
      </p>
      <h2>Location</h2>
      <p>
        Your browser asks permission before sharing your location. It is used
        for your current activity search and is not stored as location history.
        You can choose a center or draw an area instead. Map providers receive
        normal map requests and network information under their own privacy
        terms.
      </p>
      <h2>Activity assistant</h2>
      <p>
        Your question, recent conversation and relevant event information are
        sent to OpenAI to generate a reply. Your precise current location,
        password and email are not included. Responses are informational and may
        be incomplete. You can delete a conversation from its activity.
      </p>
      <h2>Email</h2>
      <p>
        Account verification, password reset and requested reminder messages are
        sent through the configured email provider. Each Going activity supports
        multiple email reminders. Once submitted, email cannot be recalled.
      </p>
      <h2>Activity data</h2>
      <p>
        Public event information is collected automatically. Sources and last
        verification times are shown. Coverage is limited to connected sources
        and the displayed service area; details and participation requirements
        can change.
      </p>
      <h2>Service providers</h2>
      <p>
        Google handles optional Google sign-in. OpenAI handles assistant
        requests. Resend handles email. Maps use OpenFreeMap, or MapTiler when
        configured. Public event venue names and addresses are sent to
        OpenStreetMap's Nominatim service for geocoding and cached locally. Your
        device location is not sent to that service. Provider credentials and
        deployment configuration are controlled by the site operator.
      </p>
    </main>
  );
}
