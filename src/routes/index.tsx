import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ArrowDown, Menu, X, Check, Plus, ArrowRight } from "lucide-react";
import collection from "@/assets/ebook-collection.jpg";
import { Button } from "@/components/ui/button";
import { SupportChat } from "@/components/support-chat";
import { getSiteContext } from "@/lib/api";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/")({
  loader: () => getSiteContext(),
  head: () => ({
    meta: [
      { title: "MenteExperta — Conhecimento. Estratégia. Ação." },
      {
        name: "description",
        content:
          "Conheça o ebook Como Fazer 100K Antes de 2027. Explore as versões Beta e Premium da MenteExperta.",
      },
      { property: "og:title", content: "MenteExperta — Conhecimento. Estratégia. Ação." },
      {
        property: "og:description",
        content: "Conheça as versões Beta e Premium do ebook Como Fazer 100K Antes de 2027.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
function Logo() {
  return (
    <a href="#home" className="brand" aria-label="MenteExperta início">
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        MenteExperta<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
const navigation = [
  ["#home", "Home"],
  ["#produtos", "Produtos"],
  ["#quem-somos", "Quem somos"],
  ["#contactos", "Contactos"],
];
function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo />
        <nav className="desktop-nav">
          {navigation.map(([href, label]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <Button asChild className="nav-buy">
          <a href="#produtos">
            Explorar ebooks <ArrowUpRight />
          </a>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="mobile-menu"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="mobile-nav">
          {navigation.map(([href, label]) => (
            <a href={href} key={href} onClick={() => setOpen(false)}>
              {label}
              <ArrowUpRight size={18} />
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
function SectionLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="section-label">
      <span>{number}</span>
      {children}
    </p>
  );
}
const testimonials = [
  {
    initials: "MA",
    name: "Marina A.",
    role: "Designer freelancer · São Paulo",
    quote:
      "Comprei o ebook num domingo e comecei a aplicar na segunda. Não foi mágica: levei três semanas até fechar o primeiro cliente. No segundo mês entraram R$ 8.400, sem gastar nada em anúncios.",
    result: "R$ 8.400",
    period: "2.º mês",
    time: "9 semanas",
  },
  {
    initials: "RM",
    name: "Rafael M.",
    role: "Estudante de engenharia · Belo Horizonte",
    quote:
      "O que mudou foi perceber que dava para começar sem investimento. Usei o que já sabia, segui o passo a passo e no primeiro mês fiz R$ 3.200. Hoje consigo pagar a faculdade sozinho.",
    result: "R$ 3.200",
    period: "1.º mês",
    time: "6 semanas",
  },
  {
    initials: "JP",
    name: "Joana P.",
    role: "Gestora de projetos · Lisboa",
    quote:
      "Estava céptica, porque já tinha lido muita coisa vaga. Este tem método. Em três meses cheguei aos R$ 12.000, mantendo o meu emprego e trabalhando duas horas por dia.",
    result: "R$ 12.000",
    period: "em 3 meses",
    time: "11 semanas",
  },
];
function Index() {
  const { region, products } = Route.useLoaderData();
  return (
    <main>
      <Nav />
      <section id="home" className="hero">
        <img
          className="hero-image"
          src={collection}
          alt="Ebooks MenteExperta, edição Beta branca e edição Premium preta com detalhes verdes"
          width={1536}
          height={1024}
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <Reveal>
            <h1>
              MenteExperta<span>.</span>
            </h1>
            <p className="hero-heading">
              Fazer <span>100K/R$</span> nunca foi difícil.
            </p>
            <p className="hero-copy">
              O difícil é o tempo que leva. E encontrar um valor para começar.
            </p>
            <Button asChild size="lg" className="action-button">
              <a href="#produtos">
                Encontre o seu próximo passo <ArrowUpRight />
              </a>
            </Button>
          </Reveal>
        </div>
        <div className="hero-bottom">
          <span>ESTRATÉGIA. CONHECIMENTO. EXECUÇÃO.</span>
          <a href="#porque" aria-label="Descobrir mais">
            <ArrowDown size={20} />
          </a>
        </div>
      </section>
      <section id="porque" className="manifesto section-wrap">
        <Reveal>
          <SectionLabel number="01">Uma nova perspectiva</SectionLabel>
          <div className="manifesto-grid">
            <h2>
              Não é só sobre
              <br />
              os <span>100K.</span>
            </h2>
            <div>
              <p className="large-copy">
                É sobre o caminho
                <br />
                que você escolhe.
              </p>
              <p className="body-copy">
                A proposta do ebook é explorar um caminho para os 100K em menos de 3 meses, antes de
                2027, sem investimento inicial.
              </p>
              <p className="disclaimer">
                Resultados dependem da execução, das condições de mercado e da realidade de cada
                pessoa. Não há garantia de rendimento.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
      <section id="produtos" className="products section-wrap">
        <Reveal>
          <SectionLabel number="02">A sua próxima leitura</SectionLabel>
          <div className="section-title-row">
            <h2>
              Uma ideia.
              <br />
              <span>Dois pontos de partida.</span>
            </h2>
            <p>
              Como Fazer 100K
              <br />
              Antes de 2027
            </p>
          </div>
        </Reveal>
        <Reveal className="collection-photo">
          <img
            src={collection}
            alt="Capas das versões Beta e Premium do ebook Como Fazer 100K Antes de 2027"
            loading="lazy"
            width={1536}
            height={1024}
          />
          <span>COLEÇÃO MENTEEXPERTA / 2026</span>
        </Reveal>
        <div className="edition-grid">
          {products.map((edition, i) => (
            <Reveal key={edition.id}>
              <article className={`edition ${edition.premium ? "edition-premium" : ""}`}>
                <div className="edition-top">
                  <span>
                    0{i + 1} / {edition.tagline}
                  </span>
                  {edition.premium && <span className="edition-tag">PREMIUM</span>}
                </div>
                <h3>
                  {edition.name}
                  <ArrowUpRight aria-hidden="true" />
                </h3>
                <ul>
                  {edition.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="edition-price">
                  <span>{region.symbol}</span> {formatPrice(edition.price)}
                </div>
                <Button
                  asChild
                  size="lg"
                  variant={edition.premium ? "default" : "outline"}
                  className="edition-button"
                >
                  <Link to="/checkout" search={{ edition: edition.id }}>
                    Quero a versão {edition.name}
                    <ArrowUpRight />
                  </Link>
                </Button>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="edition-region-note">
          {region.isMozambique
            ? "Preços apresentados em MT — pagamento por transferência e-Mola."
            : "Preços em R$ — pagamento automático por PIX."}
        </p>
      </section>
      <section className="trust section-wrap" id="depoimentos">
        <Reveal>
          <SectionLabel number="03">Depoimentos</SectionLabel>
          <div className="section-title-row">
            <h2>
              Quem aplicou.
              <br />O que <span>mudou.</span>
            </h2>
            <p>
              Demonstração de layout.
              <br />
              Os três cartões abaixo são exemplos a substituir por depoimentos verificados.
            </p>
          </div>
          <div className="testimonials">
            {testimonials.map((item) => (
              <article className="testimonial" key={item.name}>
                <div className="testimonial-head">
                  <span className="testimonial-avatar" aria-hidden="true">
                    {item.initials}
                  </span>
                  <div className="testimonial-identity">
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </div>
                  <span className="testimonial-badge">EXEMPLO</span>
                </div>
                <p className="testimonial-quote">“{item.quote}”</p>
                <dl className="testimonial-stats">
                  <div>
                    <dt>Resultado</dt>
                    <dd>{item.result}</dd>
                    <span>{item.period}</span>
                  </div>
                  <div>
                    <dt>Tempo</dt>
                    <dd>{item.time}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <p className="testimonial-note">
            Conteúdo ilustrativo: nomes, iniciais e valores são exemplos de estrutura e não
            representam resultados reais nem depoimentos de clientes. Substituir por depoimentos
            verificados antes de publicar.
          </p>
        </Reveal>
      </section>
      <section id="quem-somos" className="about section-wrap">
        <Reveal>
          <SectionLabel number="04">Quem somos</SectionLabel>
          <div className="about-grid">
            <h2>
              Empreendedores.
              <br />
              Liderados por quem <span>executa.</span>
            </h2>
            <div>
              <p className="body-copy">
                Somos um grupo de empreendedores liderado por <strong>Thiago, o CEO</strong> —
                empresário à frente de várias startups milionárias e com participação em diversos
                projetos. Reunimos essa experiência para transformar conhecimento em estratégia e
                estratégia em execução.
              </p>
              <p className="body-copy">
                O que nos move é simples: mostrar o caminho de quem já construiu, sem promessas
                fáceis e com método para começar.
              </p>
            </div>
          </div>
          <div className="principles">
            {[
              ["01", "Experiência", "Startups construídas e projetos acompanhados de perto."],
              ["02", "Visão", "A leitura de mercado de quem já operou em vários setores."],
              ["03", "Execução", "Método que sai do papel e vira resultado."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>
                  {n}
                  <Plus size={18} />
                </span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
      <section id="contactos" className="contact section-wrap">
        <Reveal>
          <SectionLabel number="05">Vamos conversar</SectionLabel>
          <div className="contact-row">
            <h2>
              O próximo passo
              <br />
              começa com uma <span>conversa.</span>
            </h2>
            <ArrowUpRight className="contact-arrow" />
          </div>
          <p>
            Pagamento por PIX (Brasil e restantes países) ou transferência e-Mola em Moçambique. O
            acesso ao ebook é liberado após a confirmação do pagamento.
          </p>
          <div className="contact-actions">
            {products.map((edition) => (
              <Button
                asChild
                key={edition.id}
                size="lg"
                variant={edition.premium ? "default" : "outline"}
              >
                <Link to="/checkout" search={{ edition: edition.id }}>
                  Comprar {edition.name}
                  <ArrowUpRight />
                </Link>
              </Button>
            ))}
          </div>
        </Reveal>
      </section>
      <footer className="site-footer">
        <Logo />
        <p>© 2026 MenteExperta</p>
        <a href="#home">
          Voltar ao topo <ArrowRight size={16} />
        </a>
      </footer>
      <SupportChat />
    </main>
  );
}
