/* Fixtures for the paste-to-create parser.
 *
 * Each entry is a job description as it actually arrives on the clipboard —
 * page furniture included, because that furniture is what the parser has to
 * survive. `expect` holds the value a human would have typed; null means the
 * field genuinely is not recoverable from the text and the parser is expected
 * to admit that rather than guess.
 *
 * Adding a fixture is the whole maintenance story for these heuristics: paste
 * a real posting, write down what it should produce, run parser-suite.js.
 */

module.exports = [
  {
    name: "structured posting with explicit labels",
    text: `Job Title: Data Analyst
Company: Northwind Trading Ltd
Location: London, UK
Salary: £45,000 – £55,000
Contract: Permanent, full-time

About the role
We are looking for a Data Analyst to join our commercial team. You will own
the weekly sales reporting pack and support the pricing group with ad-hoc
analysis.`,
    expect: {
      role: "Data Analyst",
      company: "Northwind Trading Ltd",
      location: "London",
      contactEmail: null,
    },
  },

  {
    name: "Greenhouse posting pasted whole, nav and footer included",
    text: `Skip to content
View all jobs
Senior Backend Engineer
Acme Robotics
Berlin, Germany · Engineering · Full-time
Apply for this job
Resume/CV
Attach
Dropbox
Google Drive
Enter manually
Cover Letter
About Acme Robotics
Acme Robotics builds autonomous warehouse systems for European distribution
centres. We are forty people, profitable, and shipping to eleven countries.
What you'll do
Own the ingestion pipeline that moves telemetry off the robots and into our
analytics stack.
Powered by Greenhouse`,
    expect: {
      role: "Senior Backend Engineer",
      company: "Acme Robotics",
      location: "Berlin",
      contactEmail: null,
    },
  },

  {
    name: "LinkedIn posting pasted whole, with page furniture",
    text: `Skip to main content
LinkedIn
Sign in
Join now
Investment Analyst
Bloomberg · London, United Kingdom
Hybrid
3 weeks ago · 47 applicants
Easy Apply
Save
Show more
Seniority level
Mid-Senior level
Employment type
Full-time
About the job
Bloomberg is looking for an Investment Analyst to join the EMEA equities desk.
You will produce sector notes and maintain the coverage models.
Report this job`,
    expect: {
      role: "Investment Analyst",
      company: "Bloomberg",
      location: "London (Hybrid)",
      contactEmail: null,
    },
  },

  {
    name: "prose-heavy description with no labels at all",
    text: `We are a fast-growing renewable energy consultancy based in Bristol, and we are looking for a Sustainability Consultant to support our advisory practice. You will work alongside our engineering team on feasibility studies for onshore wind and community solar, and you will spend roughly a third of your time on client sites across the south west.`,
    expect: {
      role: "Sustainability Consultant",
      company: null,
      location: "Bristol",
      contactEmail: null,
    },
  },

  {
    name: "company named only in the first line, role second",
    text: `Meridian Capital
Equity Research Associate
Full-time · Milan
Join a team of twelve analysts covering European industrials. The desk
publishes initiation notes and maintains models on thirty listed names.`,
    expect: {
      role: "Equity Research Associate",
      company: "Meridian Capital",
      location: "Milan",
      contactEmail: null,
    },
  },

  {
    name: "remote posting with no city named",
    text: `Position: Technical Writer
Company: Halyard Systems

We are fully remote. Our team spans eight countries and we have never had an
office. You will own the developer documentation for our API and SDKs.`,
    expect: {
      role: "Technical Writer",
      company: "Halyard Systems",
      location: "Remote",
      contactEmail: null,
    },
  },

  {
    name: "hybrid posting naming two locations",
    text: `Product Manager, Payments
Stripe
Hybrid — Dublin or Amsterdam
You will own the disputes surface end to end, working with a team of six
engineers and a designer.`,
    expect: {
      role: "Product Manager, Payments",
      company: "Stripe",
      location: "Dublin / Amsterdam",
      contactEmail: null,
    },
  },

  {
    name: "posting containing an application email address",
    text: `Marketing Assistant
Brightwater Media
Based in Leeds.

We need someone to run our client newsletters and keep the content calendar
honest. Agency experience helps but is not required.

To apply, send your CV to careers@brightwatermedia.co.uk by 30 September.
Please do not reply to noreply@mailer.brightwatermedia.co.uk.`,
    expect: {
      role: "Marketing Assistant",
      company: "Brightwater Media",
      location: "Leeds",
      contactEmail: "careers@brightwatermedia.co.uk",
    },
  },

  {
    name: "Italian posting with labels and an application address",
    text: `Analista Finanziario Junior
Banca Sella S.p.A.
Sede: Biella, Italia
Contratto: tempo determinato 12 mesi

Cerchiamo un Analista Finanziario Junior da inserire nel team di controllo di
gestione. Il candidato si occuperà di reportistica mensile e analisi degli
scostamenti.

Per candidarsi inviare il CV a selezioni@bancasella.it`,
    expect: {
      role: "Analista Finanziario Junior",
      company: "Banca Sella S.p.A.",
      location: "Biella",
      contactEmail: "selezioni@bancasella.it",
    },
  },

  {
    name: "short informal posting, three lines, no structure",
    text: `Barista wanted
The Daily Grind, Shoreditch
Drop in with a CV or email hello@dailygrind.co.uk`,
    expect: {
      role: "Barista wanted",
      company: "The Daily Grind, Shoreditch",
      location: null,
      contactEmail: "hello@dailygrind.co.uk",
    },
  },

  {
    name: "posting with a source URL in the paste",
    text: `Data Engineer at Zalando
Berlin
https://boards.greenhouse.io/zalando/jobs/4820117
We are rebuilding the event pipeline that powers personalisation.`,
    expect: {
      role: "Data Engineer",
      company: "Zalando",
      location: "Berlin",
      contactEmail: null,
      sourceUrl: "https://boards.greenhouse.io/zalando/jobs/4820117",
    },
  },

  /* ---- robustness: these must return nulls, never throw ---------------- */

  {
    name: "empty input",
    text: "",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "whitespace only",
    text: "   \n\n\t  \n ",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "punctuation and symbols only",
    text: "••• ——— ||| ### $$$ %%% \\\\ /// {{{ }}} [[[ ]]]",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "non-Latin script",
    text: `データアナリスト
株式会社サンプル
東京都渋谷区`,
    expect: { location: null, contactEmail: null },
    robustness: true,
    /* Role and company are deliberately unasserted: the structural rules will
       return the first two lines at low confidence, which is the honest
       answer for a script this parser has no vocabulary for. What matters is
       that it does not throw and does not claim confidence. */
  },

  /* ---- holdout ---------------------------------------------------------
     Written after the parser was already passing everything above, and
     scored separately. The tuned set measures whether the rules do what they
     were built to do; only this set says anything about a posting the parser
     has never seen. Do not tune against these — add new fixtures above
     instead, and let this number move on its own. */

  {
    name: "holdout: Lever posting with a bulleted header",
    holdout: true,
    text: `Careers
Senior Compliance Officer
Revolut · London, UK
Full time
Apply for this job
We're looking for a Senior Compliance Officer to join our financial crime team.
You will own the transaction monitoring rulebook.`,
    expect: { role: "Senior Compliance Officer", company: "Revolut", location: "London" },
  },
  {
    name: "holdout: location on the first line",
    holdout: true,
    text: `Manchester, UK
Junior Software Developer
Codeworks Digital
£28,000 per annum
Permanent, hybrid working`,
    expect: { role: "Junior Software Developer", company: "Codeworks Digital", location: "Manchester (Hybrid)" },
  },
  {
    name: "holdout: Italian posting in capitals with a labelled site",
    holdout: true,
    text: `ACCOUNT MANAGER
FERRERO S.P.A.
Sede di lavoro: Alba (CN)
Contratto a tempo indeterminato
Inviare candidatura a hr@ferrero.com`,
    expect: {
      role: "ACCOUNT MANAGER", company: "FERRERO S.P.A.",
      location: "Alba (CN)", contactEmail: "hr@ferrero.com",
    },
  },
  {
    name: "holdout: public sector posting with a reference number",
    holdout: true,
    text: `Research Assistant (Ref: RA-2291)
University of Edinburgh
School of Informatics
Grade UE06
Closing date: 12 September 2026`,
    expect: { role: "Research Assistant", company: "University of Edinburgh", location: "Edinburgh" },
  },
  {
    name: "holdout: a noreply address before the real one",
    holdout: true,
    text: `Customer Success Manager
Zeta Analytics
Remote (UK)
This message was sent from noreply@zetaanalytics.io
Questions? Write to talent@zetaanalytics.io`,
    expect: {
      role: "Customer Success Manager", company: "Zeta Analytics",
      location: "Remote", contactEmail: "talent@zetaanalytics.io",
    },
  },
  {
    name: "holdout: Indeed listing with salary and posting age",
    holdout: true,
    text: `Indeed
Warehouse Operative - Night Shift
Kuehne+Nagel
Milton Keynes
£13.50 an hour
Posted 4 days ago
Easy apply
Full job description
We are recruiting Warehouse Operatives for our night shift operation.`,
    expect: {
      role: "Warehouse Operative - Night Shift", company: "Kuehne+Nagel",
      location: null, contactEmail: null,
    },
  },
  {
    name: "holdout: recruiter advert that never names the employer",
    holdout: true,
    text: `Our client, a leading asset manager, is looking for a Portfolio Analyst.
Location: London (hybrid, 3 days in office)
Salary: competitive
Contact: james.hall@apexrecruit.co.uk`,
    expect: {
      role: "Portfolio Analyst", company: null,
      location: "London (Hybrid)", contactEmail: "james.hall@apexrecruit.co.uk",
    },
  },
  {
    name: "holdout: two cities on a labelled line, with a source URL",
    holdout: true,
    text: `Data Protection Officer
Vodafone
Location: Milan / Rome
Apply via https://careers.vodafone.com/job/12345`,
    expect: {
      role: "Data Protection Officer", company: "Vodafone",
      location: "Milan / Rome",
      sourceUrl: "https://careers.vodafone.com/job/12345",
    },
  },
  /* ---- wrapper class: the failure this round exists to fix -------------
     A posting does not begin at line 1. Portals, agencies and job boards
     wrap the employer's text in their own, and the wrapper is written in
     the same register as the posting — headings, prose, capitals — so a
     chrome blocklist does not touch it. */

  {
    name: "portal: university careers wrapper with an advisory preamble",
    holdout: true,
    text: `Job or Opportunity details
Back to search results
It is your responsibility to research the organisation before applying. We
recommend that you read our guidance on researching employers.
Please ensure that you have read the job description in full before applying.
This vacancy was advertised in good faith and may already have been filled.
The Careers Service cannot take responsibility for the content of external
vacancies.
Book a CV check or a mock interview with the Careers Service.
How did you find out about this opportunity?
Share this job
About this role
Location: Victoria, London (5 days onsite)
Salary: £30,000-£40,000
Employment Type: Full-time, Permanent
Start date: September 2026
About Novabook
Novabook is a Series A company building accounting software for small
businesses. Novabook was founded by two former accountants who were tired of
spreadsheets. Since launch, Novabook has grown to sixty people.
What you'll be doing
We're hiring Startup Operations Graduates across several teams. You will sit
with the operations group at Novabook and rotate through finance, partnerships
and customer operations over your first year.
Novabook works in person five days a week because we believe early-career
people learn faster in a room together.
Why Novabook
Novabook offers equity to every employee. Novabook has been profitable since
2024.`,
    expect: {
      role: "Startup Operations Graduate",
      company: "Novabook",
      location: "Victoria, London",
      salary: "£30,000-£40,000",
      contactEmail: null,
    },
  },

  {
    name: "portal: recruitment agency branding above the employer",
    holdout: true,
    text: `Hartwell Recruitment
Specialist recruiters in finance and professional services since 1994.
Register with us
Upload your CV
Our consultants will contact you within 48 hours of applying.
Hartwell Recruitment acts as an employment agency for permanent recruitment.
Job Details
Location: Bristol
Salary: £42,000 per annum
Our client
Ferrowick Engineering designs and manufactures pressure vessels for the energy
sector. Ferrowick has operated from the same site for forty years and now
employs three hundred people. Ferrowick is investing heavily in automation.
The opportunity
We are looking for a Quality Engineer to join the Ferrowick team. You will own
inspection planning and supplier audits.`,
    expect: {
      role: "Quality Engineer",
      company: "Ferrowick Engineering",
      location: "Bristol",
      salary: "£42,000 per annum",
    },
  },

  {
    name: "portal: Indeed paste with sponsored and apply furniture",
    holdout: true,
    text: `Indeed
Sponsored
Apply now
Save this job
Report this job
You will be redirected to the employer's site to complete your application.
Junior Accountant
Marchmont Foods Ltd
Leeds
£26,000 - £29,000 a year
Full-time
Apply now
Job details
Location: Leeds
Salary: £26,000 - £29,000 a year
Full job description
Marchmont Foods is a family-owned producer supplying supermarkets across the
north of England. Marchmont Foods is looking for a Junior Accountant to join
the finance team.`,
    expect: {
      role: "Junior Accountant",
      company: "Marchmont Foods Ltd",
      location: "Leeds",
      salary: "£26,000 - £29,000 a year",
    },
  },

  {
    name: "no wrapper: a company careers page",
    holdout: true,
    text: `Senior Platform Engineer
Location: Amsterdam
Salary: €75,000 - €95,000
About Tessellate
Tessellate builds observability tooling for Kubernetes operators. We are a
team of thirty and we have been profitable since 2023.
The role
You will own the query engine that backs our dashboards.`,
    expect: {
      role: "Senior Platform Engineer",
      company: "Tessellate",
      location: "Amsterdam",
      salary: "€75,000 - €95,000",
    },
  },

  {
    name: "no label anywhere: the employer must come from repetition alone",
    holdout: true,
    text: `Data Engineer
Full-time, permanent
We are rebuilding the ingestion layer at Kestrel. Kestrel processes forty
billion events a day for broadcasters across Europe. You will join the platform
group, which owns everything from the edge collectors through to the warehouse.
Kestrel runs a four-day week and has done since 2021.
Kestrel was founded in 2019 by three engineers from the broadcast industry.
Working at Kestrel means owning what you ship.`,
    expect: { role: "Data Engineer", company: "Kestrel", location: null },
  },

  {
    name: "portal: Italian posting inside an Italian-language wrapper",
    holdout: true,
    text: `Dettagli dell'offerta
Torna ai risultati della ricerca
È tua responsabilità verificare l'affidabilità dell'azienda prima di
candidarti. Ti consigliamo di leggere la nostra guida.
Il servizio placement non si assume alcuna responsabilità per il contenuto
degli annunci pubblicati da terzi.
Questo annuncio è stato pubblicato in buona fede e la posizione potrebbe essere
già stata ricoperta.
Condividi questo annuncio
Informazioni sulla posizione
Sede: Bologna
Stipendio: €28.000 - €32.000
Tipo di contratto: Tempo indeterminato
Chi è Farnese Digitale
Farnese Digitale è un'agenzia che progetta esperienze digitali per il settore
culturale. Farnese Digitale è stata fondata nel 2016 e conta quaranta persone.
Cosa farai
Stiamo cercando un Front-end Developer da inserire nel team di sviluppo.
In Farnese Digitale lavorerai su progetti per musei e fondazioni.`,
    expect: {
      role: "Front-end Developer",
      company: "Farnese Digitale",
      location: "Bologna",
      salary: "€28.000 - €32.000",
    },
  },

  /* ---- round-2 holdout ------------------------------------------------
     Written after the scored rewrite was already passing everything above,
     and run once before any of them was looked at: 81% (role 67%, company
     83%, location 83%). The four misses are recorded in design/PROPOSAL.md
     along with the fixes. They are kept here as regression cover, but they
     are tuned-against now and no longer measure generalisation. */

  {
    holdout: true,
    name: "H2: job board with heavy furniture, employer only in the body",
  text: `Otta
Discover
Saved
Profile
Sign in
Matched to your preferences
Apply
Not interested
Product Analyst
£55,000 – £65,000
London · Hybrid
Employees: 51-200
Funding: Series B
About the role
Curveline is a payments infrastructure company. Curveline processes card
transactions for marketplaces across Europe. You will join the analytics team
and own the merchant reporting suite. Curveline has raised $40m to date and
the analytics function is three people today.`,
    expect: { role: "Product Analyst", company: "Curveline", location: "London (Hybrid)" },
  },
  {
    holdout: true,
    name: "H2: agency whose own name repeats through the body",
  text: `Kestenbridge Associates
Contact Kestenbridge Associates
Kestenbridge Associates is a specialist recruiter for the legal sector.
Register your CV with Kestenbridge Associates today.
Our consultants will be in touch within 48 hours.
Kestenbridge Associates acts as an employment agency.
Job Details
Location: Manchester
Salary: £38,000 - £45,000
The opportunity
Our client, Halloway Trust, is a regional charity managing forty properties.
Halloway Trust was founded in 1978. Halloway Trust is looking for a Property
Manager to oversee its residential portfolio.`,
    expect: { role: "Property Manager", company: "Halloway Trust", location: "Manchester", salary: "£38,000 - £45,000" },
  },
  {
    holdout: true,
    name: "H2: public sector posting, heavily labelled",
  text: `Job Details
Employer: Southmoor NHS Foundation Trust
Job Title: Clinical Audit Officer
Location: Sheffield
Salary: £29,970 - £36,483 per annum
Contract: Permanent
Hours: 37.5 per week
Closing date: 14 October 2026
Job overview
The post holder will support the clinical audit programme across all
directorates.`,
    expect: { role: "Clinical Audit Officer", company: "Southmoor NHS Foundation Trust",
            location: "Sheffield", salary: "£29,970 - £36,483 per annum" },
  },
  {
    holdout: true,
    name: "H2: Italian careers page, no wrapper, company via About heading",
  text: `Sviluppatore Backend
Sede: Torino
Contratto: tempo indeterminato
Chi siamo
Vertico è una software house che realizza piattaforme per la logistica.
Vertico nasce nel 2014 e oggi conta ottanta persone.
Cosa farai
Lavorerai sul motore di calcolo delle rotte insieme a un team di sei persone.`,
    expect: { role: "Sviluppatore Backend", company: "Vertico", location: "Torino" },
  },
  {
    holdout: true,
    name: "H2: long preamble, role only in a label, company only by repetition",
  text: `Opportunity details
Back to search results
Please note that this vacancy is advertised on behalf of an external employer.
It is your responsibility to check the terms offered before accepting any role.
The university takes no responsibility for the content of external vacancies.
We recommend that you read our guidance on evaluating graduate schemes.
How did you find out about this opportunity?
Print this page
Position: Commercial Graduate Scheme
Location: Reading
Salary: £32,000
About the scheme
Thornhaugh runs a two-year rotation across pricing, supply and category
management. Thornhaugh places graduates in a different business unit every six
months. Thornhaugh has run the scheme since 2009 and most participants stay
with Thornhaugh afterwards.`,
    expect: { role: "Commercial Graduate Scheme", company: "Thornhaugh",
            location: "Reading", salary: "£32,000" },
  },
  {
    holdout: true,
    name: "H2: Lever posting with a breadcrumb and a plural title",
  text: `Back to Ravenwood jobs
Ravenwood
Engineering
Machine Learning Engineers
Amsterdam
Full-time
Apply for this job
Ravenwood builds forecasting tools for energy traders. We are hiring Machine
Learning Engineers to work on our short-term price models.`,
    expect: { role: "Machine Learning Engineer", company: "Ravenwood", location: "Amsterdam" },
  },
];
