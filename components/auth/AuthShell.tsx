import Image from 'next/image'
import Link from 'next/link'

type AuthShellProps = {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-leaf">
            <Image
              src="/brand/wheat-mark-transparent.png"
              alt="CropIntel"
              width={24}
              height={24}
              className="h-6 w-auto object-contain"
              priority
            />
          </span>
          <span className="font-display text-xl font-extrabold text-ink">CropIntel</span>
        </Link>

        <section className="surface rounded-2xl p-5 sm:p-7">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-primary-900 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-field-soil">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-field-soil">{footer}</div>}
        </section>
      </div>
    </main>
  )
}
