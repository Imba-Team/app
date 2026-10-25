import Link from 'next/link';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Why it works', href: '#why-it-works' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Sign up', href: '/register' },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-black/5 bg-white/40 py-16 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="inline-block font-sans text-xl font-bold text-neutral-800">
              Mimir
            </Link>
            <p className="mt-4 max-w-xs text-sm text-neutral-600">
              Spaced repetition, done right. Learn faster and remember longer.
            </p>
          </div>

          {footerLinks.map(({ title, links }) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold text-neutral-900">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-black/5 pt-8">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Mimir. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
