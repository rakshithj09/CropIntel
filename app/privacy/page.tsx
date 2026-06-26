import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - CropIntel',
  description: 'How CropIntel collects, uses, stores, and shares user data.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-field-cream px-4 py-16 text-ink sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-10">
        <Link className="text-sm font-bold text-primary-800 hover:text-primary-950" href="/login">
          Back to CropIntel
        </Link>
        <h1 className="mt-6 text-3xl font-extrabold text-primary-950 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-field-soil">Effective date: June 26, 2026</p>

        <div className="mt-8 space-y-8 leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-primary-950">What CropIntel Collects</h2>
            <p className="mt-3">
              CropIntel collects account details such as your name, email address, password credentials handled by
              Firebase Authentication, email verification status, and account creation time. CropIntel also stores farm
              details you enter, including farm name, address, state, crops grown, acreage, optional latitude and
              longitude, join codes, and farm membership records.
            </p>
            <p className="mt-3">
              When you run a diagnosis, CropIntel sends the uploaded crop photo and selected crop to the CropIntel
              prediction endpoint. Diagnosis records stored in Firestore include your user ID, farm ID, crop, disease
              result, confidence score, and detection time. The browser also saves recent diagnosis history locally on
              your device, including a resized copy of the photo, unless you clear it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Why Data Is Collected</h2>
            <p className="mt-3">
              CropIntel uses account data to sign you in, send verification and password reset emails, and connect you
              to your farm records. Farm details are used to limit crop choices, adjust disease context by region, and
              show local risk information. Uploaded photos are used to produce crop disease predictions. Diagnosis
              records help show saved field checks and associate results with the right account and farm.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Where Data Is Stored</h2>
            <p className="mt-3">
              Account authentication data is stored by Firebase Authentication. User profiles, farms, farm memberships,
              join-code lookup records, and diagnosis records are stored in Firebase Firestore. Prediction service audit
              logs may store request time, crop, model version, prediction result, confidence, quality metrics, latency,
              and a SHA-256 hash of the uploaded image. CropIntel does not store original uploaded crop photos on the
              server in the current app flow.
            </p>
            <p className="mt-3">
              Browser-saved diagnosis history is stored in your browser local storage and remains on that device until
              you clear it, clear site data, or uninstall the browser/app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Who Receives Data</h2>
            <p className="mt-3">
              Firebase receives account, authentication, and Firestore data because CropIntel uses Firebase services.
              Google Maps may receive map usage and location-related requests when map features are loaded. The
              CropIntel inference service receives uploaded crop photos and selected crop values to return predictions.
              CropIntel does not sell user data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Retention</h2>
            <p className="mt-3">
              Account, farm, membership, and diagnosis records are kept while your account remains active or until they
              are deleted through an account deletion request. Prediction audit logs are retained for operations,
              abuse prevention, debugging, and model quality review. Browser-saved diagnosis history is controlled by
              you through the “Clear” action in saved checks or by clearing browser site data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Your Choices</h2>
            <p className="mt-3">
              You can avoid optional location collection by entering address, state, latitude, or longitude manually
              instead of using the browser location button. You can clear saved checks from the saved checks page. To
              request account deletion or deletion of farm and diagnosis records linked to your account, email
              privacy@cropintel.app from the email address on your CropIntel account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Security</h2>
            <p className="mt-3">
              CropIntel uses Firebase Authentication, Firestore access rules, authenticated prediction requests,
              server-side input validation, file type and size limits, and rate limiting to reduce unauthorized access
              and abuse. No system can guarantee perfect security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary-950">Contact</h2>
            <p className="mt-3">
              For privacy questions, deletion requests, or data requests, contact CropIntel at{' '}
              <a className="font-bold text-primary-800 hover:text-primary-950" href="mailto:privacy@cropintel.app">
                privacy@cropintel.app
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
