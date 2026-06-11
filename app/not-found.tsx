import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen pt-20 pb-24 flex flex-col items-center justify-center text-center px-5">
      <p className="section-tag mb-4">404</p>
      <h1 className="font-serif text-display-lg text-white mb-4">Страницата не е намерена</h1>
      <div className="gold-divider" />
      <p className="font-sans text-sm font-light text-gray-450 mt-8 mb-10 tracking-wide">
        Страницата, която търсите, не съществува или е преместена.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/" className="btn-primary">Към начало</Link>
        <Link href="/watches" className="btn-outline">Разгледай часовници</Link>
      </div>
    </div>
  );
}
