import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description: "Politica de confidențialitate Lorenzo Ricci - cum colectăm, folosim și protejăm datele dumneavoastră cu caracter personal, în conformitate cu GDPR.",
  alternates: { canonical: "https://lorenzo-ricci.com/ro/politici/confidentialitate" },
  other: { "content-language": "ro" },
};

export default function ConfidentialitatePage() {
  return (
    <div className="min-h-screen pt-[116px] pb-24">
      {/* Hero */}
      <div className="py-20 px-5 sm:px-8 text-center bg-ivory-paper border-b border-border">
        <p className="section-tag mb-4">Informații juridice</p>
        <h1 className="font-serif text-display-lg text-charcoal mb-4">Politica de confidențialitate</h1>
        <div className="gold-divider" />
        <p className="font-sans text-xs text-ink-faint mt-6 tracking-wide">
          Ultima actualizare: 14 octombrie 2026
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">

        {/* Intro */}
        <div className="mb-10 font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide flex flex-col gap-4">
          <p>
            Lorenzo Ricci EOOD administrează acest magazin și site web, împreună cu toate informațiile,
            conținutul, funcțiile, instrumentele, produsele și serviciile asociate, pentru a vă oferi,
            ca client, o experiență de cumpărare personalizată („Serviciile”). Această Politică de
            confidențialitate descrie modul în care colectăm, folosim și dezvăluim datele dumneavoastră
            cu caracter personal atunci când vizitați, utilizați sau efectuați o achiziție ori o altă
            tranzacție prin intermediul Serviciilor sau când comunicați cu noi în alt mod, în
            conformitate cu Regulamentul (UE) 2016/679 (GDPR). Dacă există o contradicție între{" "}
            <Link href="/ro/politici/termeni" className="text-navy hover:underline">Termenii și condițiile</Link>{" "}
            noastre și prezenta Politică de confidențialitate, aceasta din urmă prevalează în ceea ce
            privește colectarea, prelucrarea și dezvăluirea datelor dumneavoastră cu caracter personal.
          </p>
          <p>
            Vă rugăm să citiți cu atenție această Politică de confidențialitate. Prin utilizarea
            Serviciilor confirmați că ați citit prezenta politică și că înțelegeți modul în care sunt
            colectate, folosite și dezvăluite informațiile dumneavoastră, așa cum este descris aici.
          </p>
        </div>

        <PolicySection title="Datele cu caracter personal pe care le colectăm sau le prelucrăm">
          <p className="mb-4">
            Prin „date cu caracter personal” înțelegem informațiile care vă identifică sau care pot fi
            asociate în mod rezonabil cu dumneavoastră ori cu o altă persoană. Datele cu caracter personal
            nu includ informațiile colectate anonim sau cele care au fost anonimizate astfel încât să nu
            mai poată fi asociate în mod rezonabil cu dumneavoastră. În funcție de modul în care
            interacționați cu Serviciile, putem colecta sau prelucra următoarele categorii de date:
          </p>
          <ul>
            <li><strong>Date de contact</strong>, inclusiv numele, adresa, adresa de facturare, adresa de livrare, numărul de telefon și adresa de e-mail.</li>
            <li><strong>Informații privind plata</strong>, inclusiv modalitatea de plată aleasă, datele tranzacției și confirmarea plății.</li>
            <li><strong>Informații privind tranzacția</strong>, inclusiv articolele pe care le vizualizați, le adăugați în coș, le cumpărați, le returnați, le schimbați sau le anulați, precum și tranzacțiile dumneavoastră anterioare.</li>
            <li><strong>Comunicările cu noi</strong>, inclusiv informațiile pe care le includeți în mesajele adresate nouă, de exemplu într-o solicitare către serviciul pentru clienți.</li>
            <li><strong>Informații despre dispozitiv</strong>, inclusiv informații despre dispozitivul, browserul sau conexiunea la rețea, adresa IP și alți identificatori unici.</li>
            <li><strong>Informații privind utilizarea</strong>, inclusiv informații despre modul și momentul în care interacționați cu Serviciile sau navigați în ele.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Sursele datelor cu caracter personal">
          <p className="mb-4">Putem colecta date cu caracter personal din următoarele surse:</p>
          <ul>
            <li><strong>Direct de la dumneavoastră</strong>, inclusiv atunci când plasați o comandă, vizitați sau folosiți Serviciile, comunicați cu noi ori ne furnizați în alt mod datele dumneavoastră.</li>
            <li><strong>Automat, prin intermediul Serviciilor</strong>, inclusiv de pe dispozitivul dumneavoastră atunci când folosiți produsele sau serviciile noastre ori vizitați site-urile noastre, precum și prin utilizarea cookie-urilor și a tehnologiilor similare.</li>
            <li><strong>De la furnizorii noștri de servicii</strong>, inclusiv atunci când îi angajăm pentru a activa o anumită tehnologie și când aceștia colectează sau prelucrează datele dumneavoastră în numele nostru.</li>
            <li>De la partenerii noștri sau de la alte terțe părți.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Cum folosim datele dumneavoastră și temeiurile prelucrării">
          <p className="mb-4">În funcție de modul în care interacționați cu noi sau de Serviciile pe care le folosiți, putem prelucra datele cu caracter personal în următoarele scopuri:</p>
          <ul>
            <li><strong>Furnizarea, adaptarea și îmbunătățirea Serviciilor:</strong> folosim datele dumneavoastră pentru a vă oferi Serviciile, inclusiv pentru a prelucra plățile, a onora comenzile, a organiza livrarea și a facilita returnările și schimburile. Temei: executarea contractului încheiat cu dumneavoastră (art. 6 alin. (1) lit. b din GDPR) și, pentru îmbunătățirea Serviciilor, interesul nostru legitim (art. 6 alin. (1) lit. f).</li>
            <li><strong>Marketing și publicitate:</strong> folosim datele dumneavoastră în scopuri de marketing și promoționale, de exemplu pentru a trimite mesaje de marketing și pentru a afișa reclame online pe baza activității dumneavoastră. Temei: consimțământul dumneavoastră, atunci când legea îl cere (art. 6 alin. (1) lit. a), sau interesul nostru legitim de a ne promova produsele (art. 6 alin. (1) lit. f). Vă puteți retrage consimțământul sau vă puteți dezabona oricând.</li>
            <li><strong>Securitate și prevenirea fraudei:</strong> folosim datele dumneavoastră pentru a asigura securitatea comenzilor și a identifica activități frauduloase sau răuvoitoare. Temei: interesul nostru legitim (art. 6 alin. (1) lit. f).</li>
            <li><strong>Comunicarea cu dumneavoastră:</strong> pentru a vă oferi asistență, a vă răspunde rapid și a menține relația comercială cu dumneavoastră. Temei: executarea contractului sau interesul nostru legitim.</li>
            <li><strong>Motive juridice:</strong> pentru a respecta legislația aplicabilă sau pentru a răspunde unor proceduri legale valide. Temei: îndeplinirea unei obligații legale (art. 6 alin. (1) lit. c).</li>
          </ul>
        </PolicySection>

        <PolicySection title="Cum dezvăluim datele dumneavoastră cu caracter personal">
          <p className="mb-4">În anumite situații putem dezvălui datele dumneavoastră unor terțe părți, în scopuri legitime, în conformitate cu prezenta Politică de confidențialitate. Aceste situații pot include:</p>
          <ul>
            <li>Furnizori și alte terțe părți care prestează servicii în numele nostru (de exemplu, curierat și livrare, prelucrarea plăților, analiza datelor, asistență pentru clienți, stocare în cloud, onorarea comenzilor).</li>
            <li>Parteneri de afaceri și de marketing, care vă pot oferi servicii de marketing. Partenerii noștri vor folosi informațiile dumneavoastră în conformitate cu propriile declarații de confidențialitate.</li>
            <li>Atunci când ne instruiți sau vă dați în alt mod acordul pentru dezvăluirea anumitor informații unor terțe părți, de exemplu pentru a vi se expedia produsele.</li>
            <li>Partenerii noștri sau, în alt mod, în cadrul grupului nostru corporativ.</li>
            <li>În legătură cu o tranzacție comercială, cum ar fi o fuziune, sau pentru a respecta obligațiile legale aplicabile.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Site-uri și legături ale terților">
          <p>
            Serviciile pot conține legături către site-uri sau alte platforme online administrate de terți.
            Dacă accesați legături către site-uri care nu sunt afiliate sau controlate de noi, vă rugăm să
            consultați politicile lor de confidențialitate. Nu garantăm și nu ne asumăm răspunderea pentru
            confidențialitatea sau securitatea unor astfel de site-uri.
          </p>
        </PolicySection>

        <PolicySection title="Datele copiilor">
          <p>
            Serviciile nu sunt destinate utilizării de către copii și nu colectăm cu bună știință date cu
            caracter personal despre copii. Dacă sunteți părinte sau tutore al unui copil care ne-a
            furnizat datele sale personale, ne puteți contacta pentru a solicita ștergerea acestora.
          </p>
        </PolicySection>

        <PolicySection title="Securitatea și păstrarea datelor dumneavoastră">
          <p>
            Vă rugăm să rețineți că nicio măsură de securitate nu este perfectă și nu putem garanta o
            „securitate perfectă”. Perioada în care păstrăm datele dumneavoastră cu caracter personal
            depinde de mai mulți factori, de exemplu dacă avem nevoie de ele pentru a vă furniza
            serviciile sau pentru a respecta obligații legale (printre care cele contabile).
          </p>
        </PolicySection>

        <PolicySection title="Drepturile dumneavoastră și opțiunile pe care le aveți">
          <p className="mb-4">În conformitate cu GDPR, aveți următoarele drepturi:</p>
          <ul>
            <li><strong>Dreptul de acces:</strong> să solicitați accesul la datele cu caracter personal pe care le deținem despre dumneavoastră.</li>
            <li><strong>Dreptul la ștergere:</strong> să solicitați ștergerea datelor cu caracter personal pe care le deținem despre dumneavoastră.</li>
            <li><strong>Dreptul la rectificare:</strong> să solicitați corectarea datelor inexacte.</li>
            <li><strong>Dreptul la portabilitatea datelor:</strong> să primiți o copie a datelor dumneavoastră și să solicitați transmiterea lor către o terță parte.</li>
            <li><strong>Dreptul la opoziție și la restricționarea prelucrării:</strong> să ne solicitați să încetăm sau să restricționăm prelucrarea datelor în anumite scopuri.</li>
            <li><strong>Retragerea consimțământului:</strong> aveți dreptul să vă retrageți oricând consimțământul pentru prelucrarea datelor, fără a afecta legalitatea prelucrării efectuate înainte de retragere.</li>
            <li><strong>Gestionarea preferințelor:</strong> vă puteți dezabona oricând de la e-mailurile promoționale.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Plângeri">
          <p>
            Dacă aveți nemulțumiri legate de modul în care prelucrăm datele dumneavoastră cu caracter
            personal, vă rugăm să ne contactați. Aveți, de asemenea, dreptul de a depune o plângere la o
            autoritate de supraveghere, de exemplu la Autoritatea Națională de Supraveghere a Prelucrării
            Datelor cu Caracter Personal (ANSPDCP) din România -{" "}
            <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">dataprotection.ro</a>
            {" "}- sau la Comisia pentru Protecția Datelor Personale din Bulgaria, țara în care ne aflăm -{" "}
            <a href="https://cpdp.bg" target="_blank" rel="noopener noreferrer" className="text-navy hover:underline">cpdp.bg</a>.
          </p>
        </PolicySection>

        <PolicySection title="Transferuri internaționale">
          <p>
            Vă rugăm să rețineți că putem transfera, stoca și prelucra datele dumneavoastră cu caracter
            personal în afara țării în care locuiți, inclusiv în afara Spațiului Economic European,
            bazându-ne pe mecanisme de transfer recunoscute, cum sunt clauzele contractuale standard.
          </p>
        </PolicySection>

        <PolicySection title="Modificări ale prezentei Politici de confidențialitate">
          <p>
            Putem actualiza periodic prezenta Politică de confidențialitate. Vom publica versiunea
            revizuită pe acest site și vom actualiza data din rubrica „Ultima actualizare”.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            Dacă aveți întrebări despre practicile noastre de confidențialitate sau doriți să vă
            exercitați oricare dintre drepturi, vă rugăm să ne scrieți la{" "}
            <a href="mailto:info@lorenzo-ricci.com" className="text-navy hover:underline">
              info@lorenzo-ricci.com
            </a>{" "}
            sau să ne contactați la adresa: ul. Petar Slabakov 33, Varna 9010, Bulgaria. În sensul
            legislației aplicabile privind protecția datelor, Lorenzo Ricci EOOD este operatorul datelor
            dumneavoastră cu caracter personal.
          </p>
        </PolicySection>

      </div>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-xl text-charcoal mb-4">{title}</h2>
      <div className="font-sans text-sm font-light text-ink-soft leading-relaxed tracking-wide [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2.5 [&_ul]:mt-1 [&_li]:flex [&_li]:items-start [&_li]:gap-2 before:[&_li]:content-['◈'] before:[&_li]:text-navy/40 before:[&_li]:text-[10px] before:[&_li]:mt-[3px] before:[&_li]:flex-shrink-0 [&_strong]:text-charcoal [&_strong]:font-normal">
        {children}
      </div>
      <div className="mt-8 h-px bg-border" />
    </section>
  );
}
