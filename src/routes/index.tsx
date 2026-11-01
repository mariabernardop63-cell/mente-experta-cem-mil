import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X, Check, Star, Mail, Phone, Instagram } from "lucide-react";
import beta from "@/assets/ebook-beta.jpg";
import premium from "@/assets/ebook-premium.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MenteExperta — Como Fazer 100K Antes de 2027" },
      { name: "description", content: "Aprenda a fazer 100K em menos de 3 meses, sem investimento inicial. Ebook MenteExperta." },
      { property: "og:title", content: "MenteExperta — Como Fazer 100K Antes de 2027" },
      { property: "og:description", content: "100K em menos de 3 meses, sem investimento inicial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

const links = [
  { href: "#home", label: "Home" },
  { href: "#produtos", label: "Produtos" },
  { href: "#quem-somos", label: "Quem Somos" },
  { href: "#contactos", label: "Contactos" },
];

function Logo() {
  return (
    <a href="#home" className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/60 font-display text-xl font-bold text-gold">M</span>
      <span className="font-display text-2xl font-semibold tracking-wide">Mente<span className="text-gold-gradient">Experta</span></span>
    </a>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 30);
    f(); window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "border-b bg-background/85 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-gold">{l.label}</a>
          ))}
          <a href="#produtos" className="rounded-sm bg-gold-gradient px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground shadow-gold">Comprar</a>
        </nav>
        <button className="md:hidden text-gold" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <nav className="flex flex-col gap-6 border-t bg-background px-6 py-8 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm uppercase tracking-[0.25em] text-foreground">{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-6 flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.4em] text-gold"><span className="h-px w-10 bg-gold/60" />{children}<span className="h-px w-10 bg-gold/60" /></p>;
}

const betaFeatures = ["Método completo passo a passo", "Estratégias sem investimento inicial", "Plano de ação de 90 dias", "Acesso imediato em PDF"];
const premiumFeatures = ["Tudo da versão Beta", "Resultados mais rápidos", "Estratégias avançadas e exclusivas", "Modelos e scripts prontos a usar", "Estudos de caso reais", "Atualizações vitalícias", "Suporte prioritário"];

const testimonials = [
  { name: "Ricardo M.", role: "Empreendedor digital", text: "Segui o plano à risca e em 10 semanas ultrapassei os 100K. Conteúdo direto, sem enrolação." },
  { name: "Juliana S.", role: "Ex-funcionária CLT", text: "Comecei sem um real para investir. Hoje tenho o meu próprio negócio. Mudou a minha vida." },
  { name: "André L.", role: "Estudante", text: "A versão Premium vale cada centavo. As estratégias avançadas aceleraram tudo." },
];

function Index() {
  return (
    <div className="overflow-x-hidden">
      <Nav />

      {/* HERO */}
      <section id="home" className="relative flex min-h-screen items-center justify-center bg-radial-glow px-6 pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(var(--gold) 1px, transparent 1px), linear-gradient(90deg, var(--gold) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal><Eyebrow>MenteExperta</Eyebrow></Reveal>
          <Reveal delay={150}>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-8xl">
              Fazer <span className="text-gold-gradient italic">100K/R$</span> Nunca Foi Difícil.
            </h1>
          </Reveal>
          <Reveal delay={350}>
            <p className="mx-auto mt-8 max-w-3xl font-display text-2xl leading-snug text-muted-foreground md:text-4xl">
              O difícil é o <span className="text-foreground">tempo que leva</span> e encontrar um valor como <span className="text-foreground">investimento inicial</span>.
            </p>
          </Reveal>
          <Reveal delay={550}>
            <a href="#porque" className="mt-14 inline-block text-xs uppercase tracking-[0.4em] text-gold animate-pulse">Deslize ↓</a>
          </Reveal>
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="porque" className="flex min-h-screen items-center justify-center border-y px-6 py-32">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal><Eyebrow>A Promessa</Eyebrow></Reveal>
          <Reveal delay={150}><p className="font-display text-3xl md:text-5xl">Por isso que você está aqui.</p></Reveal>
          <Reveal delay={300}>
            <p className="mt-8 font-display text-2xl leading-relaxed text-muted-foreground md:text-4xl">
              Eu não vou ensinar como fazer apenas 100K, mas sim como fazer os
            </p>
          </Reveal>
          <Reveal delay={450}>
            <h2 className="mt-8 font-display text-4xl font-bold uppercase leading-tight md:text-7xl">
              <span className="text-gold-gradient">100K em menos de 3 meses</span>
            </h2>
          </Reveal>
          <Reveal delay={600}>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-foreground md:text-lg">
              (Antes de 2027) e sem nenhum investimento inicial.
            </p>
          </Reveal>
        </div>
      </section>

      {/* PRODUTOS */}
      <section id="produtos" className="px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal><Eyebrow>Produtos</Eyebrow></Reveal>
          <Reveal delay={100}><h2 className="text-center font-display text-4xl md:text-6xl">Escolha a sua versão</h2></Reveal>

          {/* Beta */}
          <div className="mt-20 grid items-center gap-12 md:grid-cols-2">
            <Reveal><img src={beta} alt="Ebook Como Fazer 100K Antes de 2027 — Versão Beta" className="w-full rounded-sm border shadow-gold" loading="lazy" width={1024} height={1280} /></Reveal>
            <Reveal delay={200}>
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-gold">Versão Beta</span>
              <h3 className="mt-4 font-display text-4xl font-semibold md:text-5xl">Como Fazer 100K Antes de 2027</h3>
              <ul className="mt-8 space-y-3">
                {betaFeatures.map((f) => <li key={f} className="flex items-center gap-3 text-muted-foreground"><Check className="h-4 w-4 text-gold" />{f}</li>)}
              </ul>
              <p className="mt-10 font-display text-6xl font-bold">R$ 19,90</p>
              <a href="#contactos" className="mt-8 inline-block rounded-sm border border-gold px-10 py-4 text-xs font-bold uppercase tracking-[0.25em] text-gold transition-colors hover:bg-gold hover:text-primary-foreground">Comprar Beta</a>
            </Reveal>
          </div>

          {/* Premium */}
          <Reveal className="mt-32">
            <div className="relative overflow-hidden rounded-sm border border-gold/50 bg-card p-8 shadow-gold md:p-14">
              <div className="absolute inset-0 bg-radial-glow" />
              <div className="relative grid items-center gap-12 md:grid-cols-2">
                <div className="md:order-2"><img src={premium} alt="Ebook Como Fazer 100K Antes de 2027 — Versão Premium" className="w-full rounded-sm" loading="lazy" width={1024} height={1280} /></div>
                <div>
                  <span className="inline-block rounded-full bg-gold-gradient px-4 py-1 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">Premium · Recomendado</span>
                  <h3 className="mt-6 font-display text-4xl font-semibold md:text-5xl">Como Fazer 100K Antes de 2027 <span className="text-gold-gradient italic">Premium</span></h3>
                  <p className="mt-4 text-muted-foreground">Mais rápido, mais estratégias e um caminho ainda mais curto até aos seus primeiros 100K.</p>
                  <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                    {premiumFeatures.map((f) => <li key={f} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 shrink-0 text-gold" />{f}</li>)}
                  </ul>
                  <p className="mt-10 font-display text-6xl font-bold text-gold-gradient">R$ 399,89</p>
                  <a href="#contactos" className="mt-8 inline-block rounded-sm bg-gold-gradient px-10 py-4 text-xs font-bold uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-transform hover:scale-105">Quero o Premium</a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROVAS SOCIAIS */}
      <section className="border-y bg-card px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal><Eyebrow>Provas Sociais</Eyebrow></Reveal>
          <Reveal delay={100}><h2 className="text-center font-display text-4xl md:text-6xl">Resultados que falam por si</h2></Reveal>
          <div className="mt-16 grid grid-cols-3 gap-6 text-center">
            {[["+2.400", "Leitores"], ["4.9/5", "Avaliação"], ["90", "Dias de plano"]].map(([n, l], i) => (
              <Reveal key={l} delay={i * 150}><p className="font-display text-4xl font-bold text-gold-gradient md:text-6xl">{n}</p><p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">{l}</p></Reveal>
            ))}
          </div>
          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 150}>
                <div className="h-full rounded-sm border bg-background p-8">
                  <div className="flex gap-1 text-gold">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-6 font-display text-xl italic leading-relaxed">“{t.text}”</p>
                  <p className="mt-6 text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* QUEM SOMOS */}
      <section id="quem-somos" className="px-6 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal><Eyebrow>Quem Somos Nós</Eyebrow></Reveal>
          <Reveal delay={100}><h2 className="font-display text-4xl md:text-6xl">Mentes que pensam <span className="text-gold-gradient italic">diferente</span></h2></Reveal>
          <Reveal delay={250}>
            <p className="mt-10 text-lg leading-relaxed text-muted-foreground">
              A MenteExperta nasceu com uma missão: provar que liberdade financeira não depende de capital inicial, mas de conhecimento, estratégia e execução. Reunimos métodos testados no mercado digital num formato direto, prático e acessível — para que qualquer pessoa possa construir os seus primeiros 100K em tempo recorde.
            </p>
          </Reveal>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {[["Estratégia", "Métodos validados, sem teoria vazia."], ["Velocidade", "Resultados em semanas, não anos."], ["Acessível", "Zero investimento inicial."]].map(([t, d], i) => (
              <Reveal key={t} delay={i * 150}><div className="border-t border-gold/50 pt-6"><p className="font-display text-2xl text-gold">{t}</p><p className="mt-2 text-sm text-muted-foreground">{d}</p></div></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTOS */}
      <section id="contactos" className="border-t bg-card px-6 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal><Eyebrow>Contactos</Eyebrow></Reveal>
          <Reveal delay={100}><h2 className="font-display text-4xl md:text-6xl">Fale connosco</h2></Reveal>
          <Reveal delay={250}>
            <div className="mt-12 flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-14">
              <a href="mailto:contacto@menteexperta.com" className="flex items-center gap-3 hover:text-gold"><Mail className="h-5 w-5 text-gold" />contacto@menteexperta.com</a>
              <a href="tel:+5500000000000" className="flex items-center gap-3 hover:text-gold"><Phone className="h-5 w-5 text-gold" />+55 00 00000-0000</a>
              <a href="#" className="flex items-center gap-3 hover:text-gold"><Instagram className="h-5 w-5 text-gold" />@menteexperta</a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">© 2026 MenteExperta. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
