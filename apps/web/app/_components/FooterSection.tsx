import { Twitter, Instagram, Youtube, Linkedin } from 'lucide-react';
import Link from 'next/link';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Mobile App', 'Browser Extension'],
  Resources: ['Blog', 'Help Center', 'Guides', 'Community'],
  Company: ['About Us', 'Careers', 'Press', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
};

const SOCIAL = [
  { icon: Twitter, label: 'Twitter' },
  { icon: Instagram, label: 'Instagram' },
  { icon: Youtube, label: 'YouTube' },
  { icon: Linkedin, label: 'LinkedIn' },
];

export default function FooterSection() {
  return (
    <footer className="mt-24 border-t border-black/5 bg-white/40 py-16 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Link
              href="/"
              className="inline-block text-xl font-bold text-neutral-800"
            >
              Mimir
            </Link>
            <p className="mt-4 max-w-xs text-sm text-neutral-600">
              Spaced repetition, done right. Learn faster and remember longer.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {SOCIAL.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold text-neutral-900">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-8 md:flex-row">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Mimir. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
              Privacy
            </a>
            <a href="#" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
              Terms
            </a>
            <a href="#" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
