import Link from 'next/link'
import { ArrowLeft, CalendarDays, Database, Mail, ShieldCheck, Trash2 } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy - CropIntel',
  description: 'How CropIntel collects, uses, stores, and shares user data.',
}

export default function PrivacyPolicyPage() {
  const summaryItems = [
    {
      title: 'Photos',
      text: 'Used for diagnosis and not stored as original uploads in the current server flow.',
      icon: Database,
    },
    {
      title: 'Farm data',
      text: 'Stored in Firebase and limited by authenticated farm membership rules.',
      icon: ShieldCheck,
    },
    {
      title: 'Deletion',
      text: 'Request account, farm, and diagnosis deletion by email.',
      icon: Trash2,
    },
  ]

  const sections = [
    {
      title: 'What CropIntel Collects',
      content: (
        <>
          <p>
            CropIntel collects account details such as your name, email address, password credentials handled by
            Firebase Authentication, email verification status, and account creation time. CropIntel also stores farm
            details you enter, including farm name, address, state, crops grown, acreage, optional latitude and
            longitude, join codes, and farm membership records.
          </p>
          <p>
            When you run a diagnosis, CropIntel sends the uploaded crop photo and selected crop to the CropIntel
            prediction endpoint. Diagnosis records stored in Firestore include your user ID, farm ID, crop, disease
            result, confidence score, and detection time. The browser also saves recent diagnosis history locally on
            your device, including a resized copy of the photo, unless you clear it.
          </p>
        </>
      ),
    },
    {
      title: 'Why Data Is Collected',
      content: (
        <p>
          CropIntel uses account data to sign you in, send verification and password reset emails, and connect you to
          your farm records. Farm details are used to limit crop choices, adjust disease context by region, and show
          local risk information. Uploaded photos are used to produce crop disease predictions. Diagnosis records help
          show saved field checks and associate results with the right account and farm.
        </p>
      ),
    },
    {
      title: 'Where Data Is Stored',
      content: (
        <>
          <p>
            Account authentication data is stored by Firebase Authentication. User profiles, farms, farm memberships,
            join-code lookup records, and diagnosis records are stored in Firebase Firestore. Prediction service audit
            logs may store request time, crop, model version, prediction result, confidence, quality metrics, latency,
            and a SHA-256 hash of the uploaded image. CropIntel does not store original uploaded crop photos on the
            server in the current app flow.
          </p>
          <p>
            Browser-saved diagnosis history is stored in your browser local storage and remains on that device until
            you clear it, clear site data, or uninstall the browser/app.
          </p>
        </>
      ),
    },
    {
      title: 'Who Receives Data',
      content: (
        <p>
          Firebase receives account, authentication, and Firestore data because CropIntel uses Firebase services.
          Google Maps may receive map usage and location-related requests when map features are loaded. The CropIntel
          inference service receives uploaded crop photos and selected crop values to return predictions. CropIntel
          does not sell user data.
        </p>
      ),
    },
    {
      title: 'Retention',
      content: (
        <p>
          Account, farm, membership, and diagnosis records are kept while your account remains active or until they are
          deleted through an account deletion request. Prediction audit logs are retained for operations, abuse
          prevention, debugging, and model quality review. Browser-saved diagnosis history is controlled by you through
          the Clear action in saved checks or by clearing browser site data.
        </p>
      ),
    },
    {
      title: 'Your Choices',
      content: (
        <p>
          You can avoid optional location collection by entering address, state, latitude, or longitude manually instead
          of using the browser location button. You can clear saved checks from the saved checks page. To request account
          deletion or deletion of farm and diagnosis records linked to your account, email privacy@cropintel.app from the
          email address on your CropIntel account.
        </p>
      ),
    },
    {
      title: 'Security',
      content: (
        <p>
          CropIntel uses Firebase Authentication, Firestore access rules, authenticated prediction requests, server-side
          input validation, file type and size limits, and rate limiting to reduce unauthorized access and abuse. No
          system can guarantee perfect security.
        </p>
      ),
    },
  ]

  return (
    <main className="min-h-screen px-4 py-10 text-ink sm:px-6 sm:py-14 lg:px-8">
      <article className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-bold text-primary-900 shadow-sm transition hover:border-leaf/30 hover:bg-white"
            href="/login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to CropIntel
          </Link>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-4 py-2 text-sm font-semibold text-field-soil">
            <CalendarDays className="h-4 w-4" />
            Effective June 26, 2026
          </div>
        </div>

        <header className="surface rounded-2xl p-6 sm:p-8">
          <div className="eyebrow">Privacy</div>
          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-primary-950 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-field-soil sm:text-lg">
            This page explains what CropIntel collects, why it is used, where it is stored, and how to contact us about
            privacy requests.
          </p>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {summaryItems.map(({ title, text, icon: Icon }) => (
            <section key={title} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-800">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-extrabold text-primary-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-field-soil">{text}</p>
            </section>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/70 bg-white/85 px-5 py-2 shadow-sm sm:px-8">
          {sections.map((section) => (
            <section key={section.title} className="border-b border-field-soil/10 py-7 last:border-b-0">
              <div className="grid gap-3 md:grid-cols-[14rem_1fr] md:gap-8">
                <h2 className="text-xl font-extrabold leading-tight text-primary-950">{section.title}</h2>
                <div className="space-y-3 leading-7 text-slate-700">{section.content}</div>
              </div>
            </section>
          ))}

          <section className="py-7">
            <div className="grid gap-3 md:grid-cols-[14rem_1fr] md:gap-8">
              <h2 className="text-xl font-extrabold leading-tight text-primary-950">Contact</h2>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-5">
                <p className="leading-7 text-slate-700">
                  For privacy questions, deletion requests, or data requests, contact CropIntel from the email address
                  on your account.
                </p>
                <a
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-semibold text-white transition hover:bg-primary-800"
                  href="mailto:privacy@cropintel.app"
                >
                  <Mail className="h-4 w-4" />
                  privacy@cropintel.app
                </a>
              </div>
            </div>
          </section>
        </div>
      </article>
    </main>
  )
}
