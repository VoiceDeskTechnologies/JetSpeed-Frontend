import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, Bell, CheckCircle2, ChevronRight, Clock3, FileText,
  Globe2, HelpCircle, LayoutDashboard, LogOut, Menu, Package, Plane, Search,
  Settings, ShieldCheck, Ship, Sun, Moon, Truck, Trash2, Upload, Users, WalletCards, X, MessageSquare, MessageCircle, Mail, Info,
} from "lucide-react";
import { trackPackage } from "./lib/api";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { Announcement, AuthorizedPickupPerson, calculateCollectionAmount, createAnnouncement, createAuthorizedPickupPerson, createPackage, createShippingService, createSupportTicket, deleteAnnouncement, deleteInvoice, deletePackage, deletePayment, getAuthorizedPickupIdUrl, getInvoiceDownloadUrl, getProfile, getSession, listAllInvoices, listAllPayments, listAllShipments, listAllSupportTickets, listAnnouncements, listAuthorizedPickupPersons, listInvoices, listNotifications, listProfiles, listPublicAnnouncements, listShipments, listShippingServices, listSiteSettings, listSupportTickets, listTrackingEvents, markNotificationRead, recordPayment, saveSiteSetting, sendPaymentReceipt, sendWarehousePackageEmail, signIn, signUp, signOut, syncFreightForwarderAccount, updateAnnouncement, updateDeliveryPreference, updateEmail, updatePackageInvoice, updatePackageWeight, updatePassword, updateProfile, updateShipmentMilestone, updateShippingService, updateUserRole, uploadInvoiceFile } from "./lib/data";

type View = "home" | "services" | "rates" | "track" | "about" | "contact" | "help" | "terms" | "privacy" |
  "customer" | "admin";
type Modal = "login" | "signup" | null;
type ContactSettings = { support_phone: string; support_email: string; whatsapp_phone: string };
type RateSettings = { air_first_pound: number; air_second_pound: number; air_third_pound: number; air_additional_pound: number; sea_first_pound: number; sea_second_pound: number; sea_third_pound: number; sea_additional_pound: number };
const defaultRates: RateSettings = { air_first_pound: 750, air_second_pound: 1155, air_third_pound: 1754, air_additional_pound: 520.2, sea_first_pound: 560, sea_second_pound: 862, sea_third_pound: 1309, sea_additional_pound: 386.8 };
function rateForPounds(pounds: number, freight: "air" | "sea", rates: RateSettings) { const billable = Math.ceil(pounds); const prefix = freight === "air" ? "air" : "sea"; const first = rates[`${prefix}_first_pound` as keyof RateSettings] as number; const second = rates[`${prefix}_second_pound` as keyof RateSettings] as number; const third = rates[`${prefix}_third_pound` as keyof RateSettings] as number; const additional = rates[`${prefix}_additional_pound` as keyof RateSettings] as number; return billable === 1 ? first : billable === 2 ? second : Math.round(third + (billable - 3) * additional); }
const photos = {
  hero: "/images/hero-delivery.jpg",
  handoff: "https://images.pexels.com/photos/6612689/pexels-photo-6612689.jpeg?auto=compress&cs=tinysrgb&w=900",
  sea: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=700&q=85",
  cargo: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=700&q=85",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return <a className={"logo " + (compact ? "logo-compact" : "")} href="#home" aria-label="JetSpeed Couriers home">
    <img className="logo-image" src="/brand/jetspeed-logo.png" alt="JetSpeed Couriers" />
  </a>;
}

export function App() {
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<Modal>(null);
  const [openInvoicePage, setOpenInvoicePage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"customer" | "support" | "admin">("customer");
  const [authReady, setAuthReady] = useState(!supabase);
  const [contactSettings, setContactSettings] = useState<ContactSettings>({ support_phone: "+1 876 336 4724", support_email: "info@jetspeedcouriers.com", whatsapp_phone: "+1 876 336 4724" });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("jetspeed-theme") === "dark");
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? "").split(",").map((email: string) => email.trim().toLowerCase()).filter(Boolean);
  const isAdmin = userRole === "admin" || Boolean(sessionEmail && adminEmails.includes(sessionEmail.toLowerCase()));
  const isStaff = isAdmin || userRole === "support";
  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("jetspeed-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => {
    const change = () => setView((location.hash.slice(1) as View) || "home");
    window.addEventListener("hashchange", change); change();
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    listSiteSettings().then(({ data }) => {
      const settings = Object.fromEntries((data ?? []).map((item: any) => [item.key, item.value]));
      setContactSettings(current => ({ support_phone: settings.support_phone || current.support_phone, support_email: settings.support_email || current.support_email, whatsapp_phone: settings.whatsapp_phone || current.whatsapp_phone }));
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const applySession = (session: any) => { setUserId(session?.user.id ?? null); setSessionEmail(session?.user.email ?? ""); if (session?.user.id) getProfile(session.user.id).then(({ data }) => { if (adminEmails.includes((session.user.email ?? "").toLowerCase())) setUserRole("admin"); else if (data?.role === "admin" || data?.role === "support") setUserRole(data.role); else setUserRole("customer"); setAuthReady(true); void syncFreightForwarderAccount().catch(() => undefined); }).catch(() => { setUserRole(adminEmails.includes((session.user.email ?? "").toLowerCase()) ? "admin" : "customer"); setAuthReady(true); }); else { setUserRole("customer"); setAuthReady(true); } };
    getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => listener.subscription.unsubscribe();
  }, []);
  const go = (next: View) => { setMenuOpen(false); location.hash = next; window.scrollTo(0, 0); };
  const openInvoiceUpload = () => {
    setOpenInvoicePage(true);
    if (userId) go("customer");
    else { setModal("login"); go("home"); }
  };
  const logout = async () => { if (supabase) await signOut(); setUserId(null); setSessionEmail(""); go("home"); };
  if (view === "customer") return <><AnnouncementPopup onNavigate={go} onUploadInvoice={openInvoiceUpload} /><Portal admin={false} userId={userId} email={sessionEmail} role="customer" contact={contactSettings} initialPage={openInvoicePage ? "Upload Invoice" : undefined} onInitialPageApplied={() => setOpenInvoicePage(false)} onBack={() => go("home")} onLogout={logout} /></>;
  if (view === "admin") { if (!authReady) return <div className="portal-route-loading"><h2>Restoring your staff session…</h2></div>; return isStaff ? <Portal admin userId={userId} email={sessionEmail} role={userRole} contact={contactSettings} onBack={() => go("home")} onLogout={logout} /> : <PublicPage view="home" go={go} contact={contactSettings} />; }
  return <div id="top"><AnnouncementPopup onNavigate={go} onUploadInvoice={openInvoiceUpload} /><header className="site-header"><Logo />
    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button>
    <nav className={menuOpen ? "nav open" : "nav"}>{[
      ["home", "Home"], ["services", "Services"], ["rates", "Rates"], ["track", "Track Package"], ["about", "About Us"], ["contact", "Contact"], ["help", "Help Center"],
    ].map(([id, label]) => <button key={id} onClick={() => go(id as View)}>{label}</button>)}<button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><span className="nav-actions">
      {userId ? <><button className="login-link" onClick={() => go(isStaff ? "admin" : "customer")}>{isStaff ? "Staff panel" : "Dashboard"} <ArrowRight size={14} /></button><button className="button button-small logout-button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={16} /></button></> : <><button className="login-link" onClick={() => setModal("login")}>Login</button><button className="button button-small" onClick={() => setModal("signup")}>Sign Up</button></>}
    </span></nav></header>
    {view === "home" ? <Home go={go} onSignup={() => setModal("signup")} /> : <PublicPage view={view} go={go} contact={contactSettings} />}
    <Footer go={go} staffRole={isStaff && userRole !== "customer" ? userRole : null} contact={contactSettings} /><a className="floating-whatsapp" href={`https://wa.me/${contactSettings.whatsapp_phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hi JetSpeed Couriers, I would like help with a shipment or shipping enquiry.")}`} target="_blank" rel="noreferrer" aria-label="Chat with JetSpeed Couriers on WhatsApp" title="Chat with us on WhatsApp"><MessageCircle size={23} /></a>{modal && <AuthModal type={modal} onClose={() => { setModal(null); setOpenInvoicePage(false); }} onSuccess={(email) => { setSessionEmail(email); setModal(null); go("customer"); }} />}
  </div>;
}

function Home({ go, onSignup }: { go: (v: View) => void; onSignup: () => void }) {
  const [tracking, setTracking] = useState(""); const [message, setMessage] = useState("");
  const submit = async (e: FormEvent) => { e.preventDefault(); if (!tracking.trim()) return; try { const result = await trackPackage(tracking.trim()); setMessage(`${result.status} · ${result.destination}`); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to retrieve tracking information."); } };
  return <main>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><span /> JAMAICA'S SHIPPING PARTNER</p>
        <h1>Your World.<br /><em>Delivered Faster.</em></h1>
        <p className="hero-text">Shop from your favourite stores in the USA and get your packages delivered to Jamaica safely, conveniently and reliably.</p>
        <div className="hero-actions"><button className="button" onClick={onSignup}>Get your US address today <ArrowRight size={17} /></button><button className="button button-outline" onClick={() => go("track")}>Track a Package <Search size={17} /></button></div>
        <div className="hero-proof"><strong>10,000+</strong> packages delivered with care</div>
        <div className="hero-flight" aria-hidden="true"><span className="flight-label flight-origin">Miami</span><span className="flight-label flight-destination">Jamaica</span><span className="flight-route"><span className="flight-plane"><Plane size={22} /></span><span className="flight-confetti">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span></span></div>
      </div>
      <div className="hero-image"><img src={photos.hero} alt="Courier handing a package to a smiling customer" /></div>
    </section>
    <section className="service-strip" aria-label="JetSpeed services marquee"><div className="service-marquee-track"><div className="service-marquee-group"><Service icon={<Plane />} title="Air Freight" text="Fast & reliable" /><Service icon={<Ship />} title="Sea Freight" text="Cost effective" /><Service icon={<Package />} title="Package Forwarding" text="Shop worldwide" /><Service icon={<ShieldCheck />} title="Secure & Trusted" text="Your packages, our priority" /></div><div className="service-marquee-group" aria-hidden="true"><Service icon={<Plane />} title="Air Freight" text="Fast & reliable" /><Service icon={<Ship />} title="Sea Freight" text="Cost effective" /><Service icon={<Package />} title="Package Forwarding" text="Shop worldwide" /><Service icon={<ShieldCheck />} title="Secure & Trusted" text="Your packages, our priority" /></div></div></section>
    <section className="address-section container"><div className="address-intro"><p className="eyebrow orange">SHOP FROM THE USA</p><h2>Get your personal<br /><em>US address.</em></h2><p>Use your JetSpeed address at checkout and we'll forward your purchases safely to Jamaica.</p><button className="text-button" onClick={onSignup}>Get my address <ArrowRight size={16} /></button></div><div className="address-preview landing-address"><div className="address-preview-heading"><Globe2 size={16} /><strong>Your JetSpeed address will look like this</strong></div><div className="address-fields"><span><small>Name</small>Alex Davis</span><span><small>Address line 1</small>1234 JetSpeed Way</span><span><small>Address line 2 · personal identification code</small>Apt 1 · <strong>JSC 123</strong></span><span><small>City, State ZIP</small>Fort Lauderdale, FL 33301</span></div><p>Always include your personal ID code on Line 2 so we can identify your packages.</p></div></section>
    <section className="split-section container"><div className="photo-card"><img src={photos.handoff} alt="Young Caribbean woman handing a package to a customer across a service counter" /></div><div className="section-copy"><p className="eyebrow orange">WHY JETSPEED</p><h2>Bridging the gap between <em>you</em> and the world.</h2><p>International shipping made simple, secure and stress-free. Use your personal US address and we handle the rest.</p><ul className="check-list"><li><CheckCircle2 /> Easy package tracking</li><li><CheckCircle2 /> Multiple payment options</li><li><CheckCircle2 /> Fast local delivery</li></ul><button className="text-button" onClick={() => go("about")}>Learn more <ArrowRight size={16} /></button></div></section>
    <section className="tracking-banner"><div className="container tracking-inner"><div><p className="eyebrow orange">REAL-TIME VISIBILITY</p><h2>Track your package</h2><p>Get updates from our warehouse to your door.</p></div><form className="tracking-form" onSubmit={submit}><input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Enter tracking number" /><button className="button">Track now <ArrowRight size={16} /></button></form>{message && <strong className="track-result">{message}</strong>}</div></section>
    <ShippingCalculator />
    <section className="container services-section"><div className="section-heading"><div><p className="eyebrow orange">WHAT WE DO</p><h2>Our <em>services</em></h2></div><button className="text-button" onClick={() => go("services")}>View all <ChevronRight size={15} /></button></div><div className="service-grid"><ServiceCard image={photos.hero} title="Online Shopping" text="Receive purchases from the USA" /><ServiceCard image={photos.cargo} title="Commercial Shipping" text="Grow your business" /><ServiceCard image={photos.sea} title="Sea Freight" text="Ship more, save more" /></div></section>
  </main>;
}

function PublicPage({ view, go, contact }: { view: View; go: (v: View) => void; contact: ContactSettings }) {
  const content: Record<string, { title: string; intro: string }> = {
    services: { title: "Shipping solutions built around you.", intro: "From a single online order to a commercial shipment, our team keeps every delivery moving." },
    rates: { title: "Clear rates for every shipment.", intro: "Review our estimated collection rates for air and sea freight before you shop." },
    about: { title: "Moving Jamaica forward.", intro: "JetSpeed Couriers connects customers and businesses to the world with dependable logistics and personal service." },
    contact: { title: "We are here to help.", intro: "Talk to a shipping specialist about a package, account, or business solution." },
    help: { title: "Help Center", intro: "Quick answers and practical guidance for every step of your shipment." },
    terms: { title: "Terms & Conditions", intro: "Please review the terms that govern use of JetSpeed services." },
    privacy: { title: "Privacy Policy", intro: "We respect your information and explain how it is collected and protected." },
    track: { title: "Track your package.", intro: "Enter your tracking number for the latest movement and delivery estimate." },
  };
  const data = content[view] || content.about;
  return <main className="page-shell"><section className="page-hero"><p className="eyebrow orange">JETSPEED COURIERS</p><h1>{data.title}</h1><p>{data.intro}</p></section>{view === "track" ? <TrackPage /> : view === "services" ? <ServicesPage go={go} /> : view === "rates" ? <RatesPage /> : view === "contact" ? <ContactPage contact={contact} /> : view === "help" ? <HelpPage /> : view === "about" ? <AboutPage /> : <LegalPage type={view} />}</main>;
}
function TrackPage() { const [value, setValue] = useState(""); const [result, setResult] = useState(""); const [status, setStatus] = useState(""); const submit = async (e: FormEvent) => { e.preventDefault(); try { const r = await trackPackage(value); setStatus(r.status); setResult(`${r.status} — destination: ${r.destination}`); } catch (e) { setResult(e instanceof Error ? e.message : "Tracking unavailable"); } }; const milestones = ["label_created", "received_at_miami", "in_transit", "ready_for_pickup"]; const labels: Record<string, string> = { label_created: "Label created", received_at_miami: "Received at Miami hub", in_transit: "In transit", ready_for_pickup: "Ready for pickup/Delivery" }; const current = milestones.indexOf(status); return <section className="content-card"><h2>Shipment lookup</h2><form className="inline-form" onSubmit={submit}><input required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. JS250001" /><button className="button">Search shipment <Search size={16} /></button></form>{result && <div className="notice"><CheckCircle2 size={18} /> {result}</div>}<div className="timeline"><b>Shipment milestones</b><div className="milestone-list">{milestones.map((milestone, index) => <span className={index <= current ? "milestone complete" : "milestone"} key={milestone}>{index <= current ? "✓" : "○"} {labels[milestone]}{index < milestones.length - 1 && <i>→</i>}</span>)}</div></div></section>; }
function ServicesPage({ go }: { go: (v: View) => void }) { const items = [["Air freight","Fast, priority transport for time-sensitive packages.",Plane],["Sea freight","Economical consolidation for larger shipments.",Ship],["Package forwarding","A personal US address for safe online shopping.",Package],["Local delivery","Reliable last-mile delivery across Jamaica.",Truck]] as const; return <section className="service-detail-grid">{items.map(([name, text, Icon]) => <article className="detail-card" key={name}><div className="detail-icon"><Icon /></div><h2>{name}</h2><p>{text}</p><button className="text-button" onClick={() => go("contact")}>Talk to a specialist <ArrowRight size={15} /></button></article>)}</section>; }
function RatesPage() { const [rates, setRates] = useState(defaultRates); useEffect(() => { listSiteSettings().then(({ data }) => { const values = Object.fromEntries((data ?? []).map((item: any) => [item.key, Number(item.value)])); setRates(current => ({ ...current, ...Object.fromEntries(Object.keys(current).map(key => [key, Number.isFinite(values[key]) ? values[key] : current[key as keyof RateSettings]])) } as RateSettings)); }).catch(() => undefined); }, []); const rows = Array.from({ length: 10 }, (_, index) => { const pounds = index + 1; return { pounds, air: rateForPounds(pounds, "air", rates), sea: rateForPounds(pounds, "sea", rates) }; }); return <section className="content-card rates-card"><div className="rates-intro"><p className="eyebrow orange">ESTIMATED COLLECTION RATES</p><h2>Air and sea freight rates</h2><p>Use these live estimates to plan your collection cost in Jamaican dollars.</p></div><div className="table-wrap"><table><thead><tr><th>Billable weight</th><th>Air freight</th><th>Sea freight</th></tr></thead><tbody>{rows.map(rate => <tr key={rate.pounds}><td>{rate.pounds} lb</td><td><b>JMD ${rate.air.toLocaleString("en-JM")}</b></td><td><b>JMD ${rate.sea.toLocaleString("en-JM")}</b></td></tr>)}</tbody></table></div><p className="rates-note">Rates are estimates for collection charges. Fractional weights round up to the next whole pound. Customs duties, taxes, insurance, and optional local delivery fees are not included.</p></section>; }
function AboutPage() { return <><section className="content-card two-col"><div><p className="eyebrow orange">ABOUT JETSPEED COURIERS</p><h2>Connecting Jamaica to the world.</h2><p>JetSpeed Couriers is a Jamaica-based package forwarding and freight service helping families, online shoppers, entrepreneurs, and businesses receive goods from the United States safely and reliably.</p><p>Our local team is based in <b>Saint Elizabeth, Jamaica</b>, where we coordinate customer support and last-mile delivery while working with our USA warehouse network to keep every shipment moving.</p><p>From the moment you receive your personal US address to the moment your package is ready for pickup or delivery, we make the process clear, trackable, and convenient.</p><ul className="check-list"><li><CheckCircle2 /> Transparent, weight-based collection estimates</li><li><CheckCircle2 /> Dedicated support for every shipment</li><li><CheckCircle2 /> Secure handling from warehouse to Jamaica</li><li><CheckCircle2 /> Air, sea, forwarding, and local delivery options</li></ul></div><img src={photos.handoff} alt="Courier service helping a customer with a package" /></section><section className="content-card about-details"><div><h2>Our mission</h2><p>To make international shopping and shipping feel local, dependable, and accessible for customers across Jamaica.</p></div><div><h2>Our commitment</h2><p>We communicate clearly, protect customer information, handle packages responsibly, and provide practical updates at every important milestone.</p></div><div><h2>Where we serve</h2><p>Based in Saint Elizabeth and serving customers across Jamaica through our warehouse, freight, and local delivery network.</p></div></section></>; }
function ContactPage({ contact }: { contact: ContactSettings }) { const whatsappMessage = "Hi JetSpeed Couriers, I would like help with a shipment or shipping enquiry."; const whatsapp = contact.whatsapp_phone.replace(/\D/g, ""); return <section className="content-card two-col"><div><h2>Send us a message</h2><label>Name<input placeholder="Your name" /></label><label>Email<input type="email" placeholder="you@example.com" /></label><label>How can we help?<textarea rows={4} placeholder="Tell us about your shipment" /></label><button className="button">Submit request <ArrowRight size={16} /></button></div><div className="contact-info"><h3>Contact details</h3><p><a href={`tel:${contact.support_phone.replace(/\D/g, "")}`}>{contact.support_phone}</a><br /><a href={`mailto:${contact.support_email}`}>{contact.support_email}</a></p><p><b>Hours</b><br />Mon-Fri, 8:30 AM - 4:30 PM<br />Sat, 10:00 AM - 4:00 PM</p><a className="button whatsapp-contact" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Message us on WhatsApp</a></div></section>; }
function HelpPage() {
  const faqs = [
    { question: "How do I get a US address?", answer: "Create a JetSpeed account and verify your email. Your personal US warehouse address and identification code will appear in your customer portal. Use the code on Address Line 2 for every online order." },
    { question: "Why your invoice matters", answer: "Your retailer invoice or order receipt confirms what you purchased, the quantity, and the amount paid. JetSpeed uses it to match the package to your account, verify the shipment details, and prepare accurate shipping and customs documentation. Uploading a clear, complete invoice early helps avoid follow-up requests and processing delays, especially before customs clearance. Do not alter the invoice or declared values. If the retailer did not provide an invoice, upload the order confirmation or contact our support team for help. You can upload it from the Upload Invoice area in your customer dashboard or use the upload link in the warehouse email. An invoice helps us process the package accurately, but does not determine or guarantee customs charges or clearance times." },
    { question: "What items can I ship?", answer: "Most ordinary consumer goods can be shipped, including clothing, electronics, household items, and packaged goods. Do not send weapons, illegal drugs, explosives, perishable food, cash, or other restricted items. If you are unsure, contact JetSpeed before ordering." },
    { question: "How are duties and taxes calculated?", answer: "Customs duties, GCT, and other government charges are based on the item description, declared value, classification, and current Jamaican customs rules. These charges are separate from JetSpeed shipping fees and are payable when assessed." },
    { question: "Where is my package delivered?", answer: "After arrival and processing in Jamaica, you can choose an available local delivery option or arrange collection through the delivery preferences in your account. Delivery availability and fees depend on your parish and address." },
    { question: "How do I update my account?", answer: "Open Account Settings in your customer portal to update your name, phone number, delivery location, notification preferences, and preferred currency. Save your changes before leaving the page." },
    { question: "Can I combine shipments?", answer: "Eligible packages may be consolidated after they arrive at the JetSpeed warehouse. Consolidation can reduce the number of shipments, but it may change the handling time and total charge. Submit a request before payment if you want packages reviewed for consolidation." },
  ];
  return <section className="faq-grid">{faqs.map(({ question, answer }) => <details className="faq" key={question}><summary>{question}<ChevronRight size={17} /></summary><p>{answer}</p></details>)}</section>;
}
function LegalPage({ type }: { type: View }) { return <section className="content-card legal"><h2>{type === "terms" ? "Using our services" : "Your information matters"}</h2>{Array.from({ length: 5 }, (_, i) => <div key={i}><h3>{i + 1}. {type === "terms" ? ["Service terms","Prohibited items","Payment and claims","Delivery","Changes"][i] : ["Information we collect","How we use information","Sharing","Security","Your choices"][i]}</h3><p>JetSpeed Couriers provides clear, responsible shipping services. This section explains our practices, responsibilities, and the choices available to customers. Please contact support if you need clarification.</p></div>)}</section>; }

const customerMenus = [["Dashboard", LayoutDashboard], ["Track Package", Search], ["Upload Invoice", Upload], ["My Shipments", Package], ["Authorized Pickup", Users], ["Account Settings", Settings], ["Support", HelpCircle]] as const;
const adminMenus = [["Dashboard", LayoutDashboard], ["Manage Users", Users], ["Shipments", Package], ["Invoices", FileText], ["Payments", WalletCards], ["Reports", BarChart3], ["Services", Truck], ["Announcements & Updates", Bell], ["Settings", Settings], ["System Logs", Clock3], ["Support Tickets", MessageSquare]] as const;
function Portal({ admin, userId, email, role, contact, initialPage, onInitialPageApplied, onBack, onLogout }: { admin: boolean; userId: string | null; email: string; role: "customer" | "support" | "admin"; contact: ContactSettings; initialPage?: string; onInitialPageApplied?: () => void; onBack: () => void; onLogout: () => Promise<void> }) {
  const [active, setActive] = useState(initialPage || "Dashboard"); const [profile, setProfile] = useState<any>(null); const [warehouse, setWarehouse] = useState<any>({ line1: "2033 W McNab Rd, Suite S", city: "Pompano Beach", state: "Florida", zip: "33069" }); const [profileName, setProfileName] = useState(""); const [mobileMenuOpen, setMobileMenuOpen] = useState(false); const [notifications, setNotifications] = useState<any[]>([]); const [notificationsOpen, setNotificationsOpen] = useState(false); const [menuCounts, setMenuCounts] = useState<Record<string, number>>({}); const [menuTotals, setMenuTotals] = useState<Record<string, number>>({}); const menus = admin ? (role === "support" ? adminMenus.filter(([name]) => ["Dashboard", "Manage Users", "Shipments", "Invoices", "Payments", "Support Tickets"].includes(name)) : adminMenus) : customerMenus;
  useEffect(() => {
    if (initialPage) { setActive(initialPage); onInitialPageApplied?.(); }
  }, [initialPage, onInitialPageApplied]);
  useEffect(() => {
    if (!userId || admin) return;
    getProfile(userId).then(({ data }) => { setProfile(data); if (data?.full_name) setProfileName(data.full_name); }).catch(() => undefined);
    listSiteSettings().then(({ data }) => { const settings = Object.fromEntries((data ?? []).map((item: any) => [item.key, item.value])); setWarehouse({ line1: settings.warehouse_line1 || "2033 W McNab Rd, Suite S", city: settings.warehouse_city || "Pompano Beach", state: settings.warehouse_state || "Florida", zip: settings.warehouse_zip || "33069" }); }).catch(() => undefined);
  }, [admin, userId]);
  useEffect(() => {
    if (!admin || !userId || !supabase) return;
    listNotifications(userId).then(({ data }) => setNotifications(data ?? [])).catch(() => undefined);
    const client = supabase;
    const channel = client.channel(`staff-notifications-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, payload => setNotifications(current => [payload.new, ...current])).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [admin, userId]);
  useEffect(() => {
    if (!admin || !userId) return;
    Promise.all([listProfiles(), listAllShipments(), listAllInvoices(), listAllSupportTickets()]).then(([users, shipments, invoices, tickets]) => {
      const totals = { "Manage Users": users.data?.length ?? 0, Shipments: shipments.data?.length ?? 0, Invoices: invoices.data?.length ?? 0, "Support Tickets": tickets.data?.length ?? 0 };
      setMenuTotals(totals);
      let seen: Record<string, number> = {};
      try { seen = JSON.parse(localStorage.getItem("jetspeed-admin-menu-seen") || "{}") as Record<string, number>; } catch { seen = {}; }
      setMenuCounts(Object.fromEntries(Object.entries(totals).map(([key, total]) => [key, Math.max(total - (seen[key] || 0), 0)])));
    }).catch(() => undefined);
  }, [admin, userId]);
  const displayName = profileName || email.split("@")[0] || "Customer";
  const firstName = displayName.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const title = admin ? "Operations command center" : `${greeting}, ${firstName}.`;
  const goNotification = async (notification: any) => { const route = notification.type === "new_user" ? "Manage Users" : notification.type === "new_shipment" ? "Shipments" : notification.type === "new_ticket" ? "Support Tickets" : notification.type === "new_invoice" ? "Invoices" : notification.type === "new_payment" ? "Payments" : "Dashboard"; setActive(route); setNotificationsOpen(false); if (!notification.read_at) { await markNotificationRead(notification.id); setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)); } };
  return <div className="portal"><aside className={mobileMenuOpen ? "portal-side mobile-open" : "portal-side"}><div className="portal-side-top"><Logo /><button className="portal-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close dashboard menu"><X size={20} /></button></div><p className="portal-label">{admin ? (role === "support" ? "SUPPORT PANEL" : "ADMIN CONSOLE") : "CUSTOMER PORTAL"}</p>{menus.map(([name, Icon]) => <button className={active === name ? "active" : ""} key={name} onClick={() => { setActive(name); const nextSeen = { ...(() => { try { return JSON.parse(localStorage.getItem("jetspeed-admin-menu-seen") || "{}"); } catch { return {}; } })(), [name]: menuTotals[name] || 0 }; localStorage.setItem("jetspeed-admin-menu-seen", JSON.stringify(nextSeen)); setMenuCounts(current => ({ ...current, [name]: 0 })); setMobileMenuOpen(false); }}><Icon size={18} />{name}{admin && menuCounts[name] > 0 && <span className="menu-badge">{menuCounts[name] > 9 ? "9+" : menuCounts[name]}</span>}</button>)}<button className="back-link" onClick={onBack}>← Back to website</button><button className="portal-logout" onClick={onLogout}><LogOut size={16} /> Log out</button></aside><main className="portal-main"><header className="portal-header"><button className="portal-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open dashboard menu">{mobileMenuOpen ? <X /> : <Menu />}</button><div><p className="eyebrow orange">{admin ? (role === "support" ? "SUPPORT PANEL" : "ADMINISTRATION") : "CUSTOMER PORTAL"}</p><h1>{active === "Dashboard" ? title : active}</h1><p className="muted">{admin ? "Monitor the JetSpeed network and keep every shipment on schedule." : "Manage your shipments, invoices, and delivery preferences."}</p></div><div className="profile-tools">{admin && <div className="notification-wrap"><button className="notification-bell" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Open notifications"><Bell size={20} />{notifications.filter(item => !item.read_at).length > 0 && <span className="notification-badge">{notifications.filter(item => !item.read_at).length > 9 ? "9+" : notifications.filter(item => !item.read_at).length}</span>}</button>{notificationsOpen && <div className="notification-dropdown"><div className="notification-heading"><strong>Notifications</strong><small>{notifications.filter(item => !item.read_at).length} unread</small></div>{notifications.length ? notifications.slice(0, 20).map(notification => <button className={notification.read_at ? "notification-item read" : "notification-item"} key={notification.id} onClick={() => void goNotification(notification)}><strong>{notification.title}</strong><span>{notification.body}</span><small>{new Date(notification.created_at).toLocaleString()}</small></button>) : <p className="notification-empty">No notifications yet.</p>}</div>}</div>}<div className="profile"><span>{admin ? "OP" : displayName.slice(0, 2).toUpperCase()}</span><b>{admin ? (role === "support" ? "Support" : "Operations") : displayName}</b><small>{admin ? (role === "support" ? "Support staff" : "Administrator") : "Customer"}</small></div></div></header><PortalContent active={active} admin={admin} canChangeRoles={role === "admin"} userId={userId} profile={profile} warehouse={warehouse} contact={contact} onNavigate={setActive} /></main></div>;
}
type Ticket = { id: string; subject: string; category: string; priority: string; message: string; status?: string; created_at?: string };

function PortalContent({ active, admin, canChangeRoles, userId, profile, warehouse, contact, onNavigate }: { active: string; admin: boolean; canChangeRoles: boolean; userId: string | null; profile: any; warehouse: any; contact: ContactSettings; onNavigate: (view: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  useEffect(() => {
    if (!supabaseConfigured || !userId) { setLoading(false); return; }
    Promise.all([admin ? listAllShipments() : listShipments(userId), admin ? listAllSupportTickets() : listSupportTickets(userId), admin ? listProfiles() : Promise.resolve({ data: [], error: null })]).then(async ([ships, support, users]) => {
      if (ships.error || support.error) throw (ships.error || support.error);
      if (users.error) throw users.error;
      setShipments(ships.data ?? []); setTickets(support.data ?? []); setProfiles(users.data ?? []);
      if (admin) {
        const paymentRows = await listAllPayments();
        setPayments(paymentRows.error ? [] : paymentRows.data ?? []);
        const invoiceRows = await listAllInvoices();
        setInvoices(invoiceRows.error ? [] : invoiceRows.data ?? []);
      }
    }).catch((e) => setError(e instanceof Error ? e.message : "Unable to load account data.")).finally(() => setLoading(false));
  }, [userId]);
  if (!supabaseConfigured) return <section className="portal-card"><h2>Supabase is not configured</h2><p className="muted">Demo data is disabled. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, run the migrations, and sign in again.</p></section>;
  if (!userId) return <section className="portal-card"><h2>Sign in required</h2><p className="muted">Your account session is not available.</p></section>;
  if (loading) return <section className="portal-card"><h2>Loading your account…</h2></section>;
  if (error) return <section className="portal-card"><h2>Unable to load your account</h2><p className="form-error">{error}</p></section>;
  if (admin) return <><AdminWorkspace active={active} tickets={tickets} shipments={shipments} profiles={profiles} payments={payments} invoices={invoices} userId={userId} canChangeRoles={canChangeRoles} onViewCustomer={setSelectedCustomer} onShipmentCreated={shipment => setShipments(current => [shipment, ...current])} onShipmentDeleted={packageId => setShipments(current => current.filter(shipment => shipment.id !== packageId))} />{selectedCustomer && <CustomerDetailsModal profile={selectedCustomer} shipments={shipments.filter(shipment => shipment.customer_id === selectedCustomer.id)} onClose={() => setSelectedCustomer(null)} />}</>;
  return <CustomerWorkspace active={active} shipments={shipments} profile={profile} warehouse={warehouse} contact={contact} userId={userId} onNavigate={onNavigate} onTicket={async (ticket) => { const result = await createSupportTicket(userId, ticket); if (result.error) throw result.error; setTickets(current => [result.data!, ...current]); }} />;
}

function CustomerWorkspace({ active, shipments, profile, warehouse, contact, userId, onNavigate, onTicket }: { active: string; shipments: any[]; profile: any; warehouse: any; contact: ContactSettings; userId: string; onNavigate: (view: string) => void; onTicket: (ticket: Pick<Ticket, "subject" | "category" | "priority" | "message">) => Promise<void> }) {
  const [query, setQuery] = useState(""); const [tracking, setTracking] = useState(""); const [trackingResult, setTrackingResult] = useState(""); const [trackingEvents, setTrackingEvents] = useState<any[]>([]);
  const [ticket, setTicket] = useState({ subject: "", category: "Shipment", priority: "Normal", message: "" }); const [sent, setSent] = useState(false); const [ticketError, setTicketError] = useState("");
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);
  const submitTracking = async (e: FormEvent) => { e.preventDefault(); if (!tracking.trim()) return; try { const r = await trackPackage(tracking.trim()); setTrackingResult(`${r.status} · ${r.destination}`); const shipment = shipments.find(item => item.tracking_number.toLowerCase() === tracking.trim().toLowerCase()); if (shipment) { const events = await listTrackingEvents(shipment.id); setTrackingEvents(events.data ?? []); } } catch { setTrackingResult("Tracking number not found. Please check and try again."); } };
  const submitTicket = async (e: FormEvent) => { e.preventDefault(); if (!ticket.subject.trim() || !ticket.message.trim()) { setTicketError("Please enter a subject and message."); setSent(false); return; } setTicketError(""); try { await onTicket(ticket); setTicket({ subject: "", category: "Shipment", priority: "Normal", message: "" }); setSent(true); } catch (e) { setTicketError(e instanceof Error ? e.message : "Unable to submit ticket."); } };
  const visibleShipments = shipments.filter(s => `${s.tracking_number} ${s.origin} ${s.destination} ${s.status}`.toLowerCase().includes(query.toLowerCase()));
  const field = (label: string, value: string, change: (v: string) => void, type = "text") => <label>{label}<input type={type} value={value} onChange={e => change(e.target.value)} /></label>;
  if (active === "Dashboard") return <><div className="stats"><Stat icon={<Package />} value={String(shipments.length)} label="Total shipments" /><Stat icon={<Truck />} value={String(shipments.filter(s => s.status.toLowerCase().includes("transit")).length)} label="In transit" accent /><Stat icon={<CheckCircle2 />} value={String(shipments.filter(s => s.status.toLowerCase() === "delivered").length)} label="Delivered" green /></div><section className="portal-card"><div className="card-title"><div><h2>Dashboard overview</h2><p className="muted">Your latest delivery activity and account summary.</p></div><span className="status">Account active</span></div><div className="dashboard-panels"><div><h3>Your US shipping address</h3><p><b>{profile?.full_name || "Your name"}</b><br />{warehouse.line1}<br /><strong>{profile?.identifier_code || "JSC pending"}</strong><br />{warehouse.city}, {warehouse.state} {warehouse.zip}</p><small className="muted">Use your mailbox code on Address Line 2 for every order.</small></div><div><h3>Next delivery</h3><p>{shipments[0] ? <><b>{shipments[0].tracking_number}</b> is {shipments[0].status.toLowerCase()} to {shipments[0].destination}.</> : "No shipments are available yet."}</p><div className="progress"><span /></div></div></div></section><ShippingCalculator /></>;
  if (active === "Track Package") { const milestones = ["label_created", "received_at_miami", "in_transit", "ready_for_pickup"]; const labels: Record<string, string> = { label_created: "Label created", received_at_miami: "Received at Miami hub", in_transit: "In transit", ready_for_pickup: "Ready for pickup/Delivery" }; const current = trackingEvents.length ? milestones.indexOf(trackingEvents[trackingEvents.length - 1].status) : -1; return <section className="portal-card" id="portal-track"><h2>Track Package</h2><p className="muted">Enter a tracking number to see its latest scan and delivery timeline.</p><form className="inline-form" onSubmit={submitTracking}><input aria-label="Tracking number" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. JS250001" /><button className="button">Track package</button></form>{trackingResult && <div className="notice"><CheckCircle2 size={17} />{trackingResult}</div>}<div className="timeline"><h3>Shipment milestones</h3><div className="milestone-list">{milestones.map((milestone, index) => <span className={index <= current ? "milestone complete" : "milestone"} key={milestone}>{index <= current ? "✓" : "○"} {labels[milestone]}{index < milestones.length - 1 && <i>→</i>}</span>)}</div>{trackingEvents.map(event => <p key={event.id}><b>{event.description || labels[event.status] || event.status}</b><br /><span className="muted">{event.location || "JetSpeed network"} · {new Date(event.created_at).toLocaleString()}</span></p>)}</div></section>; }
  if (active === "Upload Invoice") return <InvoiceUpload shipments={shipments} userId={userId} />;
  if (active === "Authorized Pickup") return <AuthorizedPickupWorkspace userId={userId} />;
  if (active === "My Shipments") return <section className="portal-card"><div className="card-title"><div><h2>My Shipments</h2><p className="muted">Search your shipment history and open a shipment detail.</p></div></div><div className="toolbar"><input aria-label="Search shipments" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracking number or route" /><select aria-label="Filter shipments"><option>All statuses</option><option>In transit</option><option>Delivered</option></select></div><div className="table-wrap"><table><thead><tr><th>Tracking number</th><th>Status</th><th>Route</th><th>Date</th><th>Action</th></tr></thead><tbody>{visibleShipments.length ? visibleShipments.map(s => <tr key={s.id}><td><b>{s.tracking_number}</b></td><td><span className={"status " + (s.status === "in_transit" ? "in-transit" : "")}>{s.status}</span></td><td>{s.origin} → {s.destination}</td><td>{new Date(s.created_at).toLocaleDateString()}</td><td><button className="text-button" onClick={() => setTracking(s.tracking_number)}>View details <ChevronRight size={14} /></button><button className="text-button" onClick={() => onNavigate("Upload Invoice")}>Upload invoice</button></td></tr>) : <tr><td colSpan={5}>No shipments found.</td></tr>}</tbody></table></div></section>;
  if (active === "Account Settings") return <AccountSettings userId={userId} />;
  return <section className="portal-card"><div className="card-title"><div><h2>Support</h2><p className="muted">Get help from our shipping team.</p></div><a className="button button-small" href={`https://wa.me/${contact.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp us</a></div><p><a href={`mailto:${contact.support_email}`}>Email {contact.support_email}</a></p><form onSubmit={submitTicket}><div className="form-grid">{field("Subject", ticket.subject, v => setTicket({ ...ticket, subject: v }))}<label>Category<select value={ticket.category} onChange={e => setTicket({ ...ticket, category: e.target.value })}><option>Shipment</option><option>Billing</option><option>Account</option><option>Other</option></select></label><label>Priority<select value={ticket.priority} onChange={e => setTicket({ ...ticket, priority: e.target.value })}><option>Low</option><option>Normal</option><option>High</option></select></label></div><label>Message<textarea rows={5} value={ticket.message} onChange={e => setTicket({ ...ticket, message: e.target.value })} required /></label><button className="button" type="submit">Send ticket</button>{ticketError && <p className="form-error">{ticketError}</p>}{sent && <div className="notice"><CheckCircle2 size={17} />Ticket submitted successfully. Our team will respond soon.</div>}</form></section>;
}

function AuthorizedPickupWorkspace({ userId }: { userId: string }) {
  const [people, setPeople] = useState<AuthorizedPickupPerson[]>([]);
  const [form, setForm] = useState({ full_name: "", phone: "", relationship: "", id_type: "national_id" as AuthorizedPickupPerson["id_type"] });
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    listAuthorizedPickupPersons(userId).then(({ data, error: resultError }) => {
      if (!active) return;
      if (resultError) setError(resultError.message);
      else setPeople(data ?? []);
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load authorized pickup persons.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!file) { setError("Choose an identification file to upload."); return; }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Identification must be a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setError("Identification files must be 10 MB or smaller."); return; }
    setSaving(true);
    try {
      const result = await createAuthorizedPickupPerson(userId, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        relationship: form.relationship.trim() || null,
        id_type: form.id_type,
      }, file);
      if (result.error) { setError(result.error.message); return; }
      if (!result.data) { setError("The authorized pickup person could not be saved."); return; }
      setPeople(current => [result.data!, ...current]);
      setForm({ full_name: "", phone: "", relationship: "", id_type: "national_id" });
      setFile(null);
      setFileInputKey(current => current + 1);
      setMessage("Authorized pickup person added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the authorized pickup person.");
    } finally {
      setSaving(false);
    }
  };

  const viewId = async (person: AuthorizedPickupPerson) => {
    setError("");
    try {
      const result = await getAuthorizedPickupIdUrl(person.id_document_path);
      if (result.error || !result.data?.signedUrl) { setError(result.error?.message || "Unable to open the identification file."); return; }
      window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Unable to open the identification file.");
    }
  };

  return <section className="portal-card authorized-pickup-workspace">
    <h2>Authorized Pickup</h2>
    <p className="muted">Add someone you trust to collect packages on your behalf. Upload a clear photo or scan of their identification. Only you and JetSpeed staff can access these files.</p>
    <form className="pickup-person-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Full name<input value={form.full_name} onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))} maxLength={140} required /></label>
        <label>Phone number<input type="tel" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} maxLength={40} required /></label>
        <label>Relationship to you <span className="muted">(optional)</span><input value={form.relationship} onChange={event => setForm(current => ({ ...current, relationship: event.target.value }))} maxLength={80} placeholder="e.g. family member" /></label>
        <label>Identification type<select value={form.id_type} onChange={event => setForm(current => ({ ...current, id_type: event.target.value as AuthorizedPickupPerson["id_type"] }))}><option value="national_id">National ID card</option><option value="drivers_license">Driver's license</option><option value="passport">Passport</option><option value="other">Other government ID</option></select></label>
      </div>
      <label className="pickup-file-label">Identification document<input key={fileInputKey} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files?.[0] ?? null)} required /><small className="muted">PDF, JPG, or PNG; 10 MB maximum.</small></label>
      <button className="button" type="submit" disabled={saving}>{saving ? "Saving..." : "Add pickup person"}</button>
      {error && <p className="form-error">{error}</p>}
      {message && <div className="notice"><CheckCircle2 size={17} />{message}</div>}
    </form>
    <div className="pickup-person-list">
      <h3>People authorized to collect</h3>
      {loading ? <p className="muted">Loading authorized pickup persons...</p> : people.length ? people.map(person => <article className="pickup-person-card" key={person.id}>
        <div><strong>{person.full_name}</strong><span>{person.phone}{person.relationship ? ` · ${person.relationship}` : ""}</span><small>{person.id_type.replace("_", " ")} · Added {new Date(person.created_at).toLocaleDateString()}</small></div>
        <button className="button button-small" type="button" onClick={() => void viewId(person)}><FileText size={15} /> View ID</button>
      </article>) : <p className="muted">No authorized pickup persons have been added.</p>}
    </div>
  </section>;
}

function CustomerDetailsModal({ profile, shipments, onClose }: { profile: any; shipments: any[]; onClose: () => void }) {
  const [people, setPeople] = useState<AuthorizedPickupPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    listAuthorizedPickupPersons(profile.id).then(({ data, error: resultError }) => {
      if (!active) return;
      if (resultError) setError(resultError.message);
      else setPeople(data ?? []);
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load authorized pickup persons.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.id]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const viewId = async (person: AuthorizedPickupPerson) => {
    setError("");
    try {
      const result = await getAuthorizedPickupIdUrl(person.id_document_path);
      if (result.error || !result.data?.signedUrl) { setError(result.error?.message || "Unable to open the identification file."); return; }
      window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Unable to open the identification file.");
    }
  };
  const warehouseAddress = [profile.us_address_line1, profile.us_address_city, profile.us_address_state, profile.us_address_zip].filter(Boolean).join(", ");
  return <div className="modal-backdrop customer-details-backdrop" onMouseDown={onClose}>
    <section className="payment-modal customer-detail-modal" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" onMouseDown={event => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close customer details"><X /></button>
      <h2 id="customer-detail-title">{profile.full_name || "Customer details"}</h2>
      <p className="muted">Customer account and package overview.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="customer-detail-grid">
        <section><h3>Contact information</h3><p><strong>Email</strong><br />{profile.email || "Not provided"}</p><p><strong>Phone</strong><br />{profile.phone || "Not provided"}</p><p><strong>Identifier</strong><br />{profile.identifier_code || "Pending"}</p></section>
        <section><h3>Shipping & collection address</h3><p><strong>US shipping address</strong><br />{warehouseAddress || "Not available"}</p><p><strong>Collection preference</strong><br />{profile.delivery_preference === "delivery" ? "Delivery" : "Pickup"}</p><p><strong>Pickup location</strong><br />{profile.pickup_location || "Not specified"}</p></section>
      </div>
      <section className="customer-detail-section"><h3>Packages ({shipments.length})</h3><div className="table-wrap"><table><thead><tr><th>Tracking number</th><th>Status</th><th>Route</th><th>Created</th></tr></thead><tbody>{shipments.length ? shipments.map(shipment => <tr key={shipment.id}><td><b>{shipment.tracking_number}</b></td><td><span className="status">{shipment.status.replace(/_/g, " ")}</span></td><td>{shipment.origin} → {shipment.destination}</td><td>{new Date(shipment.created_at).toLocaleDateString()}</td></tr>) : <tr><td colSpan={4}>No packages on this account.</td></tr>}</tbody></table></div></section>
      <section className="customer-detail-section"><h3>Authorized pickup persons</h3>{loading ? <p className="muted">Loading authorized pickup persons...</p> : people.length ? <div className="pickup-person-list">{people.map(person => <article className="pickup-person-card" key={person.id}><div><strong>{person.full_name}</strong><span>{person.phone}{person.relationship ? ` · ${person.relationship}` : ""}</span><small>{person.id_type.replace("_", " ")}</small></div><button className="button button-small" type="button" onClick={() => void viewId(person)}><FileText size={15} /> View ID</button></article>)}</div> : <p className="muted">No authorized pickup persons on file.</p>}</section>
    </section>
  </div>;
}

function InvoiceUpload({ shipments, userId }: { shipments: any[]; userId: string }) {
  const [packageId, setPackageId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!packageId || !file) { setError("Select a package and choose an invoice file."); return; }
    const upload = await uploadInvoiceFile(userId, packageId, file);
    if (upload.error) { setError(upload.error.message); return; }
    const result = await updatePackageInvoice(packageId, userId, upload.path);
    if (result.error) { setError(result.error.message); return; }
    setMessage("Invoice uploaded and linked to your selected package.");
  };
  return <section className="portal-card"><h2>Upload Invoice</h2><p className="muted">Select the package this invoice belongs to, then upload the invoice file. Our team will read the order details from the document.</p><form onSubmit={submit}><label>Package<select value={packageId} onChange={event => setPackageId(event.target.value)}><option value="">Select a package</option>{shipments.map(shipment => <option key={shipment.id} value={shipment.id}>{shipment.tracking_number} · {shipment.origin} → {shipment.destination}</option>)}</select></label><div className="upload-box"><Upload size={30} /><h3>Choose an invoice file</h3><p className="muted">PDF, JPG or PNG up to 10 MB</p><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => setFile(event.target.files?.[0] ?? null)} /></div><button className="button full" type="submit">Upload invoice</button>{error && <p className="form-error">{error}</p>}{message && <div className="notice"><CheckCircle2 size={17} />{message}</div>}</form></section>;
}

function AccountSettings({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [preference, setPreference] = useState<"pickup" | "delivery">("pickup");
  const [shipmentEmails, setShipmentEmails] = useState(true);
  const [deliveryReminders, setDeliveryReminders] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => { getProfile(userId).then(({ data }) => { setName(data?.full_name ?? ""); setWhatsapp(data?.phone ?? ""); setEmail(data?.email ?? ""); setPreference(data?.delivery_preference === "delivery" ? "delivery" : "pickup"); setShipmentEmails(data?.shipment_status_emails ?? true); setDeliveryReminders(data?.delivery_reminders ?? true); }).catch(() => undefined); }, [userId]);
  const save = async (event: FormEvent) => { event.preventDefault(); const profileResult = await updateProfile(userId, { full_name: name.trim(), phone: whatsapp.trim() || null, shipment_status_emails: shipmentEmails, delivery_reminders: deliveryReminders }); if (profileResult.error) { setMessage(profileResult.error.message); return; } const preferenceResult = await updateDeliveryPreference(userId, preference); if (preferenceResult.error) { setMessage(preferenceResult.error.message); return; } const emailResult = email.trim() ? await updateEmail(email.trim()) : { error: null }; if (emailResult.error) { setMessage(emailResult.error.message); return; } if (newPassword) { const passwordResult = await updatePassword(newPassword); if (passwordResult.error) { setMessage(passwordResult.error.message); return; } setNewPassword(""); } setMessage("Account settings saved."); };
  return <section className="portal-card"><h2>Account Settings</h2><p className="muted">Update your profile, login credentials, and package collection preference.</p><form onSubmit={save}><div className="form-grid"><label>Full name<input value={name} onChange={event => setName(event.target.value)} required /></label><label>WhatsApp number <span className="muted">(optional)</span><input type="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder="+1 876 555 0123" /></label><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>New password <span className="muted">(optional)</span><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Leave blank to keep current password" /></label></div><h3>Package collection</h3><div className="preference-options"><label className={preference === "pickup" ? "preference-option selected" : "preference-option"}><input type="radio" name="collection" checked={preference === "pickup"} onChange={() => setPreference("pickup")} /><span><b>Pickup</b><small>Top Hill, St Elizabeth</small></span></label><label className={preference === "delivery" ? "preference-option selected" : "preference-option"}><input type="radio" name="collection" checked={preference === "delivery"} onChange={() => setPreference("delivery")} /><span><b>Delivery</b><small>Additional delivery cost applies <Info size={13} aria-label="Delivery has an additional cost based on your location and package." /></small></span></label></div><button className="button" type="submit">Save settings</button>{message && <div className="notice"><CheckCircle2 size={17} />{message}</div>}</form><h3>Notifications</h3><label className="check-option"><input type="checkbox" checked={shipmentEmails} onChange={event => setShipmentEmails(event.target.checked)} /> Shipment status emails</label><label className="check-option"><input type="checkbox" checked={deliveryReminders} onChange={event => setDeliveryReminders(event.target.checked)} /> Delivery reminders</label></section>;
}
function ReportsWorkspace({ shipments, payments }: { shipments: any[]; payments: any[] }) {
  const download = () => {
    const headers = ["Tracking number", "Customer", "Status", "Origin", "Destination", "Weight (lb)", "Freight", "Collection amount (JMD)", "Payment status", "Invoice uploaded", "Created"];
    const rows = shipments.map(shipment => { const payment = payments.find(row => row.package_id === shipment.id); return [shipment.tracking_number, shipment.customer_name || "", shipment.status, shipment.origin, shipment.destination, shipment.weight_lb || "", shipment.freight_type || "", shipment.collection_amount_jmd || "", payment?.status || "Unpaid", shipment.invoice_uploaded ? "Yes" : "No", shipment.created_at]; });
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `jetspeed-package-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="portal-card"><div className="card-title"><div><h2>Reports</h2><p className="muted">Live package, customer, cost, invoice, and payment data from Supabase.</p></div><button className="button button-small" onClick={download} disabled={!shipments.length}>Download CSV</button></div><div className="table-wrap"><table><thead><tr><th>Package</th><th>Customer</th><th>Status</th><th>Route</th><th>Weight</th><th>Cost (JMD)</th><th>Payment</th><th>Invoice</th></tr></thead><tbody>{shipments.length ? shipments.map(shipment => { const payment = payments.find(row => row.package_id === shipment.id); return <tr key={shipment.id}><td><b>{shipment.tracking_number}</b></td><td>{shipment.customer_name || "—"}</td><td>{shipment.status}</td><td>{shipment.origin} → {shipment.destination}</td><td>{shipment.weight_lb ? `${shipment.weight_lb} lb` : "—"}</td><td>{shipment.collection_amount_jmd ? `JMD $${Number(shipment.collection_amount_jmd).toLocaleString("en-JM")}` : "—"}</td><td>{payment?.status || "Unpaid"}</td><td>{shipment.invoice_uploaded ? "Uploaded" : "Missing"}</td></tr>; }) : <tr><td colSpan={8}>No package records are available.</td></tr>}</tbody></table></div></section>;
}
function SystemLogsWorkspace() {
  const [result, setResult] = useState<{ status: "operational" | "outage"; message: string; checkedAt: string } | null>(() => { try { const cached = localStorage.getItem("jetspeed-health-check"); return cached ? JSON.parse(cached) : null; } catch { return null; } });
  const [checking, setChecking] = useState(false);
  const runCheck = async () => {
    const cachedAt = result ? Date.parse(result.checkedAt) : 0;
    if (Date.now() - cachedAt < 86_400_000) return;
    setChecking(true);
    const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
    try { const response = await fetch(`${apiUrl}/health`); const healthy = response.ok; const next = { status: healthy ? "operational" : "outage" as "operational" | "outage", message: healthy ? "Backend and API are operational." : "Backend health check returned an outage response.", checkedAt: new Date().toISOString() }; setResult(next); localStorage.setItem("jetspeed-health-check", JSON.stringify(next)); } catch { const next = { status: "outage" as const, message: "Backend health check could not reach the API.", checkedAt: new Date().toISOString() }; setResult(next); localStorage.setItem("jetspeed-health-check", JSON.stringify(next)); } finally { setChecking(false); }
  };
  useEffect(() => { void runCheck(); }, []);
  return <section className="portal-card"><div className="card-title"><div><h2>System Logs</h2><p className="muted">Backend health monitoring runs no more than once every 24 hours.</p></div><button className="button button-small" onClick={runCheck} disabled={checking || Boolean(result && Date.now() - Date.parse(result.checkedAt) < 86_400_000)}>{checking ? "Checking..." : "Run daily check"}</button></div>{result ? <div className={result.status === "operational" ? "notice system-health" : "form-error system-health"}><span className={`health-dot ${result.status}`} /> <div><strong>{result.status === "operational" ? "System 100% operational" : "System outage detected"}</strong><small>{result.message}<br />Last checked {new Date(result.checkedAt).toLocaleString()}</small></div></div> : <div className="empty-state"><h3>Health check pending</h3><p className="muted">The daily backend check has not run yet.</p></div>}</section>;
}
function ServicesWorkspace() {
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", description: "", service_type: "air_freight" });
  const [message, setMessage] = useState("");
  const load = () => { listShippingServices().then(({ data, error }) => { if (error) setMessage(error.message); else setServices(data ?? []); }).catch(error => setMessage(error instanceof Error ? error.message : "Unable to load services.")); };
  useEffect(load, []);
  const add = async (event: FormEvent) => { event.preventDefault(); const result = await createShippingService(form); if (result.error) { setMessage(result.error.message); return; } setForm({ name: "", description: "", service_type: "air_freight" }); setMessage("Service added to the live catalog."); load(); };
  const toggle = async (service: any) => { const result = await updateShippingService(service.id, { name: service.name, description: service.description, service_type: service.service_type, active: !service.active }); if (result.error) setMessage(result.error.message); else load(); };
  return <section className="portal-card"><div className="card-title"><div><h2>Services</h2><p className="muted">Manage the live shipping services shown to customers.</p></div></div><form className="service-form" onSubmit={add}><label>Service name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Air Freight" required /></label><label>Service type<select value={form.service_type} onChange={event => setForm({ ...form, service_type: event.target.value })}><option value="air_freight">Air freight</option><option value="sea_freight">Sea freight</option><option value="package_forwarding">Package forwarding</option><option value="local_delivery">Local delivery</option><option value="commercial_cargo">Commercial cargo</option><option value="pickup">Pickup / collection</option><option value="consolidation">Package consolidation</option><option value="insurance">Shipment insurance</option></select></label><label>Description<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Customer-facing service description" required /></label><button className="button" type="submit">Add service</button></form>{message && <div className="notice">{message}</div>}<div className="table-wrap"><table><thead><tr><th>Service</th><th>Type</th><th>Description</th><th>Status</th><th>Action</th></tr></thead><tbody>{services.length ? services.map(service => <tr key={service.id}><td><b>{service.name}</b></td><td>{service.service_type}</td><td>{service.description}</td><td><span className="status">{service.active ? "Active" : "Inactive"}</span></td><td><button className="button button-small" onClick={() => toggle(service)}>{service.active ? "Deactivate" : "Activate"}</button></td></tr>) : <tr><td colSpan={5}>No services have been added to the live catalog yet.</td></tr>}</tbody></table></div></section>;
}
function buildDailySeries(rows: any[], key: "count") {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return date; });
  return days.map(date => { const label = date.toLocaleDateString("en-JM", { weekday: "short" }); const next = new Date(date); next.setDate(next.getDate() + 1); return { day: label, [key === "count" ? "shipments" : key]: rows.filter(row => { const created = new Date(row.created_at); return created >= date && created < next; }).length }; });
}
function buildPaymentSeries(rows: any[]) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return date; });
  return days.map(date => { const label = date.toLocaleDateString("en-JM", { weekday: "short" }); const next = new Date(date); next.setDate(next.getDate() + 1); return { day: label, revenue: rows.filter(row => { const created = new Date(row.created_at); return created >= date && created < next; }).reduce((total, row) => total + Number(row.amount || 0), 0) }; });
}
function LiveChart({ title, data, dataKey, color, empty }: { title: string; data: any[]; dataKey: string; color: string; empty: boolean }) {
  return <div className="chart-card"><h3>{title}</h3>{empty ? <p className="muted chart-empty">No live records available for this chart.</p> : <ResponsiveContainer width="100%" height={230}>{dataKey === "revenue" ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e4eaf3" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(value) => [`JMD $${Number(value ?? 0).toLocaleString("en-JM")}`, "Revenue"]} /><Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} /></BarChart> : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e4eaf3" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 3 }} /></LineChart>}</ResponsiveContainer>}</div>;
}
function AdminWorkspace({ active, tickets, shipments, profiles, payments, invoices, userId, canChangeRoles, onViewCustomer, onShipmentCreated, onShipmentDeleted }: { active: string; tickets: Ticket[]; shipments: any[]; profiles: any[]; payments: any[]; invoices: any[]; userId: string; canChangeRoles: boolean; onViewCustomer: (profile: any) => void; onShipmentCreated: (shipment: any) => void; onShipmentDeleted: (packageId: string) => void }) {
  const [roleChanges, setRoleChanges] = useState<Record<string, "customer" | "support" | "admin">>({});
  const [userSearch, setUserSearch] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const saveRole = async (profileId: string) => { const role = roleChanges[profileId]; if (!role) return; const result = await updateUserRole(profileId, role); setRoleMessage(result.error ? `Unable to update role: ${result.error.message}` : "User role updated."); };
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [weightById, setWeightById] = useState<Record<string, string>>({});
  const [savedAmounts, setSavedAmounts] = useState<Record<string, number>>({});
  const [newShipmentOpen, setNewShipmentOpen] = useState(false);
  const [localInvoices, setLocalInvoices] = useState(invoices);
  const saveMilestone = async (shipment: any) => {
    const status = statusById[shipment.id] || shipment.status;
    const labels: Record<string, string> = { label_created: "Label created", received_at_miami: "Received at Miami hub", in_transit: "In transit", ready_for_pickup: "Ready for pickup/Delivery" };
    await updateShipmentMilestone(shipment.id, status, labels[status], status === "received_at_miami" ? "Miami hub" : status === "in_transit" ? "In transit" : "JetSpeed network");
  };
  const saveWeight = async (shipment: any) => {
    const weight = Number(weightById[shipment.id]);
    if (!Number.isFinite(weight) || weight <= 0) return;
    const freightType = (shipment.freight_type === "sea" ? "sea" : "air") as "air" | "sea";
    const result = await updatePackageWeight(shipment.id, weight, freightType);
    if (!result.error) setSavedAmounts(current => ({ ...current, [shipment.id]: result.data.collection_amount_jmd }));
  };
  if (active === "Announcements & Updates") return <AnnouncementsWorkspace />;
  if (active === "Dashboard") { const inTransit = shipments.filter(shipment => shipment.status === "in_transit").length; const delivered = shipments.filter(shipment => shipment.status === "delivered").length; const shipmentTrend = buildDailySeries(shipments, "count"); const revenueTrend = buildPaymentSeries(payments); return <><div className="stats"><Stat icon={<Package />} value={String(shipments.length)} label="Shipments" /><Stat icon={<Truck />} value={String(inTransit)} label="In transit" accent /><Stat icon={<CheckCircle2 />} value={String(delivered)} label="Delivered" green /></div><section className="portal-card"><h2>Dashboard analytics</h2><p className="muted">Live operational counts from Supabase. Financial totals appear when payment records are available.</p><div className="analytics-grid"><div><b>Total users</b><strong>{profiles.length}</strong><span>Registered profiles</span></div><div><b>Total shipments</b><strong>{shipments.length}</strong><span>Current package records</span></div><div><b>Invoices uploaded</b><strong>{shipments.filter(shipment => shipment.invoice_uploaded).length}</strong><span>Linked package invoices</span></div><div><b>Open tickets</b><strong>{tickets.filter(ticket => ticket.status !== "closed").length}</strong><span>Customer support queue</span></div></div><div className="chart-grid"><LiveChart title="Shipments over time" data={shipmentTrend} dataKey="shipments" color="#1675D1" empty={!shipments.length} /><LiveChart title="Revenue from payments (JMD)" data={revenueTrend} dataKey="revenue" color="#FF7900" empty={!payments.length} /></div></section></>; }
  if (active === "Reports") return <ReportsWorkspace shipments={shipments} payments={payments} />;
  if (active === "Services") return <ServicesWorkspace />;
  if (active === "System Logs") return <SystemLogsWorkspace />;
  if (active === "Payments") return <PaymentWorkspace shipments={shipments} payments={payments} userId={userId} />;
  if (active === "Invoices") return <section className="portal-card"><div className="card-title"><div><h2>Invoices</h2><p className="muted">Uploaded invoices loaded from Supabase.</p></div></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{localInvoices.length ? localInvoices.map(invoice => <tr key={invoice.id}><td><b>{invoice.invoice_number || "Uploaded invoice"}</b></td><td><span className="status">{invoice.status}</span></td><td>{new Date(invoice.created_at).toLocaleString()}</td><td><div className="record-actions">{invoice.file_path && <button className="icon-action email" onClick={async () => { const result = await getInvoiceDownloadUrl(invoice.file_path); if (result.error || !result.data?.signedUrl) window.alert(result.error?.message || "Unable to open invoice."); else window.open(result.data.signedUrl, "_blank", "noopener,noreferrer"); }} aria-label="View or download invoice" title="View or download invoice"><FileText size={16} /></button>}<button className="icon-action danger" onClick={async () => { if (!window.confirm("Delete this invoice record?")) return; const result = await deleteInvoice(invoice.id); if (result.error) window.alert(result.error.message); else setLocalInvoices(current => current.filter(item => item.id !== invoice.id)); }} aria-label="Delete invoice" title="Delete invoice"><Trash2 size={16} /></button></div></td></tr>) : <tr><td colSpan={4}>No invoice records are available.</td></tr>}</tbody></table></div></section>;
  if (active === "Support Tickets") return <section className="portal-card"><h2>Support Tickets</h2><p className="muted">Tickets submitted by customers. Use the contact actions to reply directly.</p><div className="table-wrap"><table><thead><tr><th>ID</th><th>Customer / query</th><th>Category</th><th>Priority</th><th>Status</th><th>Reply</th></tr></thead><tbody>{tickets.length ? tickets.map(t => { const contact = (t as any).profiles || {}; const firstName = contact.full_name?.split(" ")[0] || "there"; const reply = `Hi ${firstName},\n\nThank you for contacting JetSpeed Couriers regarding "${t.subject}".\n\nWe have reviewed your message:\n"${t.message}"\n\nOur support team will assist you with the next steps.\n\nRegards,\nJetSpeed Couriers`; return <tr key={t.id}><td><b>{t.id.slice(0, 8)}</b></td><td><b>{contact.full_name || "Customer"}</b><br /><small>{t.subject}: {t.message}</small></td><td>{t.category}</td><td><span className="status">{t.priority}</span></td><td>{t.status}</td><td><div className="notification-actions">{contact.phone && <a className="icon-action whatsapp" href={`https://wa.me/${String(contact.phone).replace(/\D/g, "")}?text=${encodeURIComponent(reply)}`} target="_blank" rel="noreferrer" title="Reply on WhatsApp" aria-label="Reply on WhatsApp"><MessageCircle size={17} /></a>}{contact.email && <a className="icon-action email" href={`mailto:${contact.email}?subject=${encodeURIComponent(`Re: ${t.subject}`)}&body=${encodeURIComponent(reply)}`} title="Reply by email" aria-label="Reply by email"><Mail size={17} /></a>}{!contact.phone && !contact.email && <span className="muted">No contact details</span>}</div></td></tr>; }) : <tr><td colSpan={6}>No customer tickets yet.</td></tr>}</tbody></table></div></section>;
  if (active === "Manage Users") {
    const visibleProfiles = profiles.filter(profile => `${profile.full_name || ""} ${profile.identifier_code || ""} ${profile.phone || ""} ${profile.email || ""}`.toLowerCase().includes(userSearch.toLowerCase()));
    return <section className="portal-card">
      <div className="card-title"><div><h2>Manage Users</h2><p className="muted">Customer profiles loaded from Supabase. Select a customer to see their account and package details.</p></div></div>
      <div className="toolbar"><input placeholder="Search name, WhatsApp, email, or identifier code" value={userSearch} onChange={event => setUserSearch(event.target.value)} /></div>
      {roleMessage && <div className={roleMessage.startsWith("Unable") ? "form-error" : "notice"}>{roleMessage}</div>}
      <div className="table-wrap"><table><thead><tr><th>Name / identifier</th><th>Contact</th><th>Collection</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>
        <tbody>{visibleProfiles.length ? visibleProfiles.map(profile => {
          const message = `Hi ${profile.full_name?.split(" ")[0] || "there"}, this is JetSpeed Couriers. We are contacting you regarding your account or shipment update.`;
          return <tr key={profile.id}>
            <td><button className="customer-name-button" onClick={() => onViewCustomer(profile)}>{profile.full_name || "Unnamed customer"}</button><small className="identifier-code">{profile.identifier_code || "Identifier pending"}</small></td>
            <td><div className="notification-actions">{profile.phone && <a className="icon-action whatsapp" href={`https://wa.me/${String(profile.phone).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label="Message user on WhatsApp" title="Message on WhatsApp"><MessageCircle size={16} /></a>}{profile.email && <a className="icon-action email" href={`mailto:${profile.email}?subject=${encodeURIComponent("JetSpeed Couriers update")}&body=${encodeURIComponent(message)}`} aria-label="Email user" title="Email user"><Mail size={16} /></a>}{!profile.phone && !profile.email && <span className="muted">No contact</span>}</div></td>
            <td><span className="status">{profile.delivery_preference === "delivery" ? "Delivery" : "Pickup"}</span></td>
            <td>{canChangeRoles ? <select value={roleChanges[profile.id] || profile.role} onChange={event => setRoleChanges(current => ({ ...current, [profile.id]: event.target.value as "customer" | "support" | "admin" }))}><option value="customer">Customer</option><option value="support">Support</option><option value="admin">Admin</option></select> : <span className="status">{profile.role}</span>}</td>
            <td>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</td>
            <td>{canChangeRoles && <button className="button button-small" disabled={!roleChanges[profile.id] || roleChanges[profile.id] === profile.role} onClick={() => saveRole(profile.id)}>Save role</button>}</td>
          </tr>;
        }) : <tr><td colSpan={6}>No matching user profiles found.</td></tr>}</tbody>
      </table></div>
    </section>;
  }
  if (active === "Shipments") return <section className="portal-card"><div className="card-title"><div><h2>Shipments</h2><p className="muted">Add the received package weight to calculate the customer’s JMD collection amount.</p></div><button className="button button-small" onClick={() => setNewShipmentOpen(true)}>+ New shipment</button></div><div className="table-wrap"><table><thead><tr><th>Package</th><th>Weight / collection</th><th>Milestone</th><th>Route</th><th>Invoice</th><th>Customer alerts</th><th>Action</th></tr></thead><tbody>{shipments.length ? shipments.map(shipment => { const selectedStatus = statusById[shipment.id] || shipment.status; const canNotify = selectedStatus === "received_at_miami" || selectedStatus === "ready_for_pickup"; const amountValue = savedAmounts[shipment.id] ?? shipment.collection_amount_jmd; const amount = Number(amountValue || 0).toLocaleString("en-JM"); const firstName = shipment.customer_name?.split(" ")[0] || "there"; const message = selectedStatus === "received_at_miami" ? `Hi ${firstName}, your JetSpeed package ${shipment.tracking_number} has arrived at our Miami warehouse and is being prepared for shipment to Jamaica. We will update you as it moves through our network.` : `Hi ${firstName}, your JetSpeed package ${shipment.tracking_number} is ready for pickup/delivery. The expected collection amount is JMD $${amount}. Please contact us if you need delivery assistance.`; const emailSubject = selectedStatus === "received_at_miami" ? `JetSpeed package ${shipment.tracking_number} arrived at our warehouse` : `JetSpeed package ${shipment.tracking_number} is ready`; return <tr key={shipment.id}><td><b>{shipment.tracking_number}</b></td><td><input className="weight-input" type="number" min="0.1" step="0.1" value={weightById[shipment.id] ?? shipment.weight_lb ?? ""} onChange={event => setWeightById(current => ({ ...current, [shipment.id]: event.target.value }))} placeholder="lb" />{amountValue ? <small className="collection-amount">JMD ${amount}</small> : <small className="muted">Add weight</small>}</td><td><select value={selectedStatus} onChange={event => setStatusById(current => ({ ...current, [shipment.id]: event.target.value }))}><option value="label_created">Label created</option><option value="received_at_miami">Received at Miami hub</option><option value="in_transit">In transit</option><option value="ready_for_pickup">Ready for pickup/Delivery</option></select></td><td>{shipment.origin} → {shipment.destination}</td><td><span className="invoice-status"><FileText size={15} /> Invoice <i className={shipment.invoice_uploaded ? "pulse-dot uploaded" : "pulse-dot missing"} /></span></td><td>{canNotify ? <div className="notification-actions"><a className="icon-action whatsapp" href={`https://wa.me/${String(shipment.customer_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" title="Send WhatsApp template" aria-label="Send WhatsApp template"><MessageCircle size={17} /></a><button className="icon-action email" type="button" onClick={async () => { try { await sendWarehousePackageEmail(shipment.id); } catch (error) { window.alert(error instanceof Error ? error.message : "Unable to send warehouse email."); } }} title="Send branded warehouse email" aria-label="Send branded warehouse email"><Mail size={17} /></button></div> : <span className="muted">Available at warehouse or ready stage</span>}</td><td><div className="shipment-actions"><button className="button button-small" onClick={() => { saveWeight(shipment); saveMilestone(shipment); }}>Save package</button><button className="icon-action danger" type="button" onClick={async () => { if (!window.confirm(`Delete shipment ${shipment.tracking_number}? This cannot be undone.`)) return; const result = await deletePackage(shipment.id); if (result.error) window.alert(result.error.message); else onShipmentDeleted(shipment.id); }} title="Delete shipment" aria-label="Delete shipment"><Trash2 size={16} /></button></div></td></tr>; }) : <tr><td colSpan={7}>No shipments found.</td></tr>}</tbody></table></div>{newShipmentOpen && <NewShipmentModal profiles={profiles} onClose={() => setNewShipmentOpen(false)} onCreated={shipment => { onShipmentCreated(shipment); setNewShipmentOpen(false); }} />}</section>;
  const descriptions: Record<string, string> = { "Manage Users": "Manage customer accounts, roles, and access.", Shipments: "Monitor and update every shipment in the network.", Invoices: "Review uploaded invoices and verification status.", Payments: "Reconcile payment activity and outstanding balances.", Reports: "Build operational and financial reports.", Services: "Configure freight and delivery services.", Settings: "Configure portal defaults and administrator preferences.", "System Logs": "Review security and operational events." };
  return active === "Settings" ? <AdminSettings userId={userId} /> : <section className="portal-card"><div className="card-title"><div><h2>{active}</h2><p className="muted">{descriptions[active]}</p></div></div><div className="empty-state"><h3>No records available</h3><p className="muted">This workspace is connected to live Supabase data and will display records when they are created.</p></div></section>;
}
function NewShipmentModal({ profiles, onClose, onCreated }: { profiles: any[]; onClose: () => void; onCreated: (shipment: any) => void }) {
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [origin, setOrigin] = useState("Miami");
  const [destination, setDestination] = useState("Kingston");
  const [status, setStatus] = useState("label_created");
  const [serviceLevel, setServiceLevel] = useState("air");
  const [weightKg, setWeightKg] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [error, setError] = useState("");
  const selected = profiles.find(profile => profile.id === customerId);
  const visibleProfiles = profiles.filter(profile => `${profile.full_name || ""} ${profile.identifier_code || ""} ${profile.email || ""} ${profile.phone || ""} ${profile.role || ""}`.toLowerCase().includes(customerSearch.toLowerCase()));
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (!customerId || !trackingNumber || !origin || !destination) { setError("Customer, tracking number, origin, and destination are required."); return; } const result = await createPackage({ customer_id: customerId, tracking_number: trackingNumber.trim(), origin: origin.trim(), destination: destination.trim(), status, service_level: serviceLevel, weight_kg: weightKg ? Number(weightKg) : null, estimated_delivery: estimatedDelivery || null, customer_name: selected?.full_name || null, customer_email: selected?.email || null, customer_phone: selected?.phone || null }); if (result.error) { setError(result.error.message); return; } onCreated(result.data); };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="payment-modal new-shipment-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><h2>New shipment</h2><p className="muted">Manually add a shipment received by email or another offline channel.</p><form onSubmit={submit}><label>Search customers<input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Search name, JSC code, email, or phone" /></label><label>Customer<select value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Select customer</option>{visibleProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name || "Unnamed customer"} · {profile.identifier_code || "No code"} · {profile.role}</option>)}</select><small className="muted">{visibleProfiles.length} matching profile{visibleProfiles.length === 1 ? "" : "s"}</small></label><label>Tracking number<input value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} placeholder="e.g. JS250001" /></label><div className="form-grid"><label>Origin<input value={origin} onChange={event => setOrigin(event.target.value)} /></label><label>Destination<input value={destination} onChange={event => setDestination(event.target.value)} /></label><label>Initial milestone<select value={status} onChange={event => setStatus(event.target.value)}><option value="label_created">Label created</option><option value="received_at_miami">Received at Miami hub</option><option value="in_transit">In transit</option><option value="ready_for_pickup">Ready for pickup/Delivery</option></select></label><label>Freight type<select value={serviceLevel} onChange={event => setServiceLevel(event.target.value)}><option value="air">Air freight</option><option value="sea">Sea freight</option></select></label><label>Weight (kg) <span className="muted">(optional)</span><input type="number" min="0.01" step="0.01" value={weightKg} onChange={event => setWeightKg(event.target.value)} /></label><label>Estimated delivery <span className="muted">(optional)</span><input type="date" value={estimatedDelivery} onChange={event => setEstimatedDelivery(event.target.value)} /></label></div>{error && <p className="form-error">{error}</p>}<button className="button full" type="submit">Save shipment</button></form></div></div>;
}
function PaymentWorkspace({ shipments, payments, userId }: { shipments: any[]; payments: any[]; userId: string }) {
  const [open, setOpen] = useState(false);
  const [localPayments, setLocalPayments] = useState(payments);
  const [packageId, setPackageId] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "card">("cash");
  const [message, setMessage] = useState("");
  const selected = shipments.find(shipment => shipment.id === packageId);
  const selectedCustomer = selected?.customer_name || selected?.profiles?.full_name || "Customer profile";
  const save = async (event: FormEvent) => { event.preventDefault(); if (!selected) return; const result = await recordPayment({ package_id: selected.id, customer_id: selected.customer_id, amount: Number(selected.collection_amount_jmd || 0), payment_type: paymentType, received_by: userId }); if (result.error) { setMessage(result.error.message); return; } try { await sendPaymentReceipt(result.data.id); setMessage("Payment saved and receipt email sent to the customer."); } catch (error) { setMessage(`Payment saved, but receipt email was not sent: ${error instanceof Error ? error.message : "email service unavailable"}`); } setOpen(false); };
  return <section className="portal-card"><div className="card-title"><div><h2>Payments</h2><p className="muted">Record collection payments against live packages.</p></div><button className="button button-small" onClick={() => setOpen(true)}>+ New payment</button></div>{message && <div className="notice">{message}</div>}<div className="table-wrap"><table><thead><tr><th>Package</th><th>Amount</th><th>Type</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{localPayments.length ? localPayments.map(payment => <tr key={payment.id}><td>{shipments.find(shipment => shipment.id === payment.package_id)?.tracking_number || "—"}</td><td>JMD ${Number(payment.amount || 0).toLocaleString("en-JM")}</td><td>{payment.payment_type || "—"}</td><td><span className="status">{payment.status}</span></td><td>{new Date(payment.created_at).toLocaleString()}</td><td><button className="icon-action danger" onClick={async () => { if (!window.confirm("Delete this payment record?")) return; const result = await deletePayment(payment.id); if (result.error) window.alert(result.error.message); else setLocalPayments(localPayments.filter(item => item.id !== payment.id)); }} aria-label="Delete payment" title="Delete payment"><Trash2 size={16} /></button></td></tr>) : <tr><td colSpan={6}>No payment records are available.</td></tr>}</tbody></table></div>{open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><div className="payment-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setOpen(false)}><X /></button><h2>Record payment</h2><p className="muted">The customer is linked automatically from the selected package.</p><form onSubmit={save}><label>Package<select value={packageId} onChange={event => setPackageId(event.target.value)}><option value="">Select package</option>{shipments.map(shipment => <option key={shipment.id} value={shipment.id}>{shipment.tracking_number} · {shipment.customer_name || shipment.profiles?.full_name || "Customer profile"}</option>)}</select></label><label>Linked customer<input value={selected ? selectedCustomer : "Select a package first"} readOnly /></label><label>Status<input value="Paid" readOnly /></label><label>Payment type<select value={paymentType} onChange={event => setPaymentType(event.target.value as "cash" | "card")}><option value="cash">Cash</option><option value="card">Card</option></select></label><label>Amount (JMD)<input value={selected?.collection_amount_jmd ? `JMD $${Number(selected.collection_amount_jmd).toLocaleString("en-JM")}` : "Weight not recorded"} readOnly /></label><button className="button full" type="submit" disabled={!selected}>Save payment</button></form></div></div>}</section>;
}
function AdminSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState({ company_name: "JetSpeed Couriers", support_email: "info@jetspeedcouriers.com", support_phone: "+1 876 336 4724", whatsapp_phone: "+1 876 336 4724", warehouse_line1: "2033 W McNab Rd, Suite S", warehouse_city: "Pompano Beach", warehouse_state: "Florida", warehouse_zip: "33069", air_first_pound: "750", air_second_pound: "1155", air_third_pound: "1754", air_additional_pound: "520.2", sea_first_pound: "560", sea_second_pound: "862", sea_third_pound: "1309", sea_additional_pound: "386.8", announcement: "" });
  const [message, setMessage] = useState("");
  useEffect(() => { listSiteSettings().then(({ data }) => { (data || []).forEach((item: any) => { if (item.key in settings) setSettings(current => ({ ...current, [item.key]: String(item.value?.value ?? item.value ?? "") })); }); }).catch(() => undefined); }, []);
  const save = async (event: FormEvent) => { event.preventDefault(); for (const [key, value] of Object.entries(settings)) { const result = await saveSiteSetting(key, value, userId); if (result.error) { setMessage(result.error.message); return; } } setMessage("Live site settings saved."); };
  return <section className="portal-card"><h2>Site Settings</h2><p className="muted">These settings are stored in Supabase for use by the live site.</p><form className="form-grid" onSubmit={save}>{Object.entries(settings).map(([key, value]) => <label key={key}>{key.replace("_", " ")}<input value={value} onChange={event => setSettings(current => ({ ...current, [key]: event.target.value }))} /></label>)}<button className="button" type="submit">Save live settings</button></form>{message && <div className="notice"><CheckCircle2 size={17} />{message}</div>}</section>;
}
function Stat({ icon, value, label, accent, green }: { icon: ReactNode; value: string; label: string; accent?: boolean; green?: boolean }) { return <div className="stat"><div className={"stat-icon " + (accent ? "blue" : green ? "green" : "")}>{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>; }
function Service({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="service-item"><div className="service-icon">{icon}</div><div><strong>{title}</strong><small>{text}</small></div></div>; }
function ServiceCard({ image, title, text }: { image: string; title: string; text: string }) { return <article className="service-card"><img src={image} alt="" /><div><strong>{title}</strong><span>{text}</span></div></article>; }
function ShippingCalculator() {
  const [freight, setFreight] = useState<"air" | "sea">("air");
  const [category, setCategory] = useState("Apparel");
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState("");
  const [result, setResult] = useState<number | null>(null); const [rates, setRates] = useState(defaultRates);
  useEffect(() => { listSiteSettings().then(({ data }) => { const values = Object.fromEntries((data ?? []).map((item: any) => [item.key, Number(item.value)])); setRates(current => ({ ...current, ...Object.fromEntries(Object.keys(current).map(key => [key, Number.isFinite(values[key]) ? values[key] : current[key as keyof RateSettings]])) } as RateSettings)); }).catch(() => undefined); }, []);
  const categoryRates: Record<string, number> = { Apparel: 0, Electronics: 0.08, Shoes: 0.03, "Beauty & personal care": 0.05, "Household goods": 0.02, "Commercial goods": 0.06 };
  const calculate = (event: FormEvent) => {
    event.preventDefault();
    const declaredValue = Number(value);
    const pounds = Number(weight);
    if (!Number.isFinite(declaredValue) || declaredValue < 0 || !Number.isFinite(pounds) || pounds <= 0) { setResult(null); return; }
    const collectionAmount = rateForPounds(pounds, freight, rates);
    setResult(collectionAmount);
  };
  return <section className="calculator-section container"><div className="calculator-copy"><p className="eyebrow orange">PLAN YOUR SHIPMENT</p><h2>Estimate your collection cost.</h2><p>Choose your freight type, tell us what you're sending, and estimate the JMD amount due when you collect.</p></div><form className="calculator-card" onSubmit={calculate}><div className="calculator-row"><label>Freight type<select value={freight} onChange={e => setFreight(e.target.value as "air" | "sea")}><option value="air">Air freight · faster</option><option value="sea">Sea freight · economical</option></select></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{Object.keys(categoryRates).map(item => <option key={item}>{item}</option>)}</select></label></div><div className="calculator-row"><label>Item value (USD)<input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 150" required /></label><label>Estimated weight (lb)<input type="number" min="0.1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 5" required /></label></div><button className="button" type="submit">Calculate estimate <ArrowRight size={16} /></button>{result !== null && <div className="calculator-result"><span>Estimated collection amount</span><strong>JMD ${result.toLocaleString("en-JM")}</strong><small>{freight === "air" ? "Air freight" : "Sea freight"} · {weight} lb · {category}</small></div>}</form></section>;
}
function Footer({ go, staffRole, contact }: { go: (v: View) => void; staffRole: "admin" | "support" | null; contact: ContactSettings }) { return <footer><div className="footer-main container"><div><Logo /><p>Your world. Delivered faster.<br />Reliable shipping from the USA to Jamaica.</p></div><div><h4>Support</h4><button onClick={() => go("help")}>Help center</button><button onClick={() => go("terms")}>Terms & conditions</button><button onClick={() => go("privacy")}>Privacy policy</button></div><div><h4>Contact us</h4><p><a href={`tel:${contact.support_phone.replace(/\D/g, "")}`}>{contact.support_phone}</a><br /><a href={`mailto:${contact.support_email}`}>{contact.support_email}</a></p>{staffRole && <button className="text-button" onClick={() => go("admin")}>{staffRole === "support" ? "Support portal →" : "Admin portal →"}</button>}</div></div><div className="footer-bottom container">© {new Date().getFullYear()} JetSpeed Couriers. All rights reserved.</div></footer>; }
function AuthModal({ type, onClose, onSuccess }: { type: "login" | "signup"; onClose: () => void; onSuccess: (email: string) => void }) {
  const [mode, setMode] = useState<"login" | "signup">(type);
  const login = mode === "login";
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [whatsapp, setWhatsapp] = useState(""); const [error, setError] = useState("");
  const submit = async () => { if (!supabaseConfigured) { setError("Authentication is disabled until Supabase is configured."); return; } const result = login ? await signIn(email.trim(), password) : await signUp(email.trim(), password, name.trim(), whatsapp.trim() || undefined); if (result.error) setError(result.error.message); else onSuccess(email.trim()); };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="auth-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button><div className="auth-brand"><Logo /><p>{login ? "Welcome back to effortless shipping." : "Your world is waiting."}</p></div><div className="auth-form"><div className="auth-tabs"><button className={login ? "active" : ""} onClick={() => setMode("login")}>Login</button><button className={!login ? "active" : ""} onClick={() => setMode("signup")}>Sign up</button></div><h2>{login ? "Welcome back" : "Get your US address"}</h2><p className="muted">{login ? "Sign in to manage your shipments." : "Create your account and start shipping."}</p>{!login && <><label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label><label>WhatsApp number <span className="muted">(optional)</span><input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+1 876 555 0123" /></label></>}<label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></label>{error && <p className="form-error">{error}</p>}<button className="button full" disabled={!email.trim() || !password} onClick={submit}>{!supabaseConfigured ? "Configure Supabase to continue" : login ? "Login" : "Get my US address"} <ArrowRight size={16} /></button><p className="auth-foot">{login ? "Don't have an account? " : "Already have an account? "}<button onClick={() => setMode(login ? "signup" : "login")}>{login ? "Sign up" : "Login"}</button></p></div></div></div>;
}

let announcementShownThisSession = false;
const announcementTemplates = [
  ["service_update", "service_update", "Service update"],
  ["promotion", "promotion", "Promotion"],
  ["holiday", "promotion", "Holiday"],
  ["maintenance", "maintenance", "Maintenance"],
  ["shipping_tip", "shipping_tip", "Shipping tip"],
  ["service_update", "invoice_reminder", "Invoice reminder"],
] as const;
const announcementPresets: Record<string, Partial<Announcement>> = {
  service_update: { title: "Important service update", body: "We have an important update to our shipping services. Please review the latest details before placing your next order.", category: "service_update", template: "service_update", animation: "fade", cta_label: "Learn more", cta_url: "#services" },
  promotion: { title: "Limited-time shipping special", body: "Save on your next shipment with JetSpeed Couriers. This offer is available for a limited time.", category: "promotion", template: "promotion", animation: "slide", cta_label: "View rates", cta_url: "#rates" },
  holiday: { title: "Holiday shipping reminder", body: "Plan ahead for holiday shipping. Send your packages early to help us move them through the warehouse and into Jamaica on time.", category: "holiday", template: "promotion", animation: "fade", cta_label: "View rates", cta_url: "#rates" },
  maintenance: { title: "Scheduled service maintenance", body: "Some online services may be temporarily unavailable while we complete scheduled maintenance. We appreciate your patience.", category: "maintenance", template: "maintenance", animation: "fade", cta_label: "Contact us", cta_url: "#contact" },
  shipping_tip: { title: "Shipping tip", body: "Remember to include your JSC mailbox code on Address Line 2 every time you place an order.", category: "shipping_tip", template: "shipping_tip", animation: "fade", cta_label: "Learn more", cta_url: "#help" },
  invoice_reminder: { title: "Did you remember to upload your invoice?", body: "You can upload anytime on your JetSpeed dashboard, or use the upload link in the email sent when your package reaches our warehouse.\n\nPlease upload before Customs clearance.\nWe normally send another reminder when your package arrives in Jamaica—uploading early helps avoid delays.", category: "service_update", template: "invoice_reminder", animation: "slide", cta_label: "Sign in & Upload Invoice", cta_url: "#customer" },
};
function AnnouncementPopup({ onNavigate, onUploadInvoice }: { onNavigate: (view: View) => void; onUploadInvoice: () => void }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (announcementShownThisSession || !supabaseConfigured) return;
    listPublicAnnouncements().then(({ data }) => {
      const item = data?.[0];
      if (item) { announcementShownThisSession = true; setAnnouncement(item); if (item.countdown && item.ends_at) setSeconds(Math.max(0, Math.floor((new Date(item.ends_at).getTime() - Date.now()) / 1000))); }
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (seconds === null) return;
    const timer = window.setInterval(() => setSeconds(value => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds !== null]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setClosed(true); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  if (!announcement || closed) return null;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const animationClass = reduced ? "reduced-motion" : announcement.animation === "none" ? "" : announcement.animation;
  return <div className={`announcement-popup template-${announcement.template} ${animationClass}`} role="dialog" aria-label="JetSpeed announcement">
    <button className="announcement-close" onClick={() => setClosed(true)} aria-label="Close announcement"><X size={18} /></button>
    <span className="eyebrow orange">{announcement.template === "invoice_reminder" ? "A quick reminder" : announcement.category.replace("_", " ")}</span>
    <h2>{announcement.title}</h2>
    {announcement.template === "invoice_reminder"
      ? announcement.body.split(/\n\s*\n/).map((paragraph, index) => {
        const [lead, ...followUp] = paragraph.split("\n");
        return <p className="invoice-reminder-copy" key={index}>{index === 1 ? <><strong>{lead}</strong>{followUp.length > 0 && <> {followUp.join(" ")}</>}</> : paragraph.replace(/\n/g, " ")}</p>;
      })
      : <p>{announcement.body}</p>}
    {seconds !== null && <small className="announcement-countdown">Offer ends in {Math.floor(seconds / 86400)}d {Math.floor(seconds / 3600) % 24}h {Math.floor(seconds / 60) % 60}m</small>}
    {announcement.template === "invoice_reminder" && announcement.cta_label
      ? <button className="button button-small announcement-invoice-cta" onClick={() => { setClosed(true); onUploadInvoice(); }}>{announcement.cta_label}</button>
      : announcement.cta_label && announcement.cta_url && <a className="button button-small" href={announcement.cta_url}>{announcement.cta_label}<ArrowRight size={14} /></a>}
    {announcement.template === "invoice_reminder" && <a className="announcement-help-link" href="#help" onClick={event => { event.preventDefault(); setClosed(true); onNavigate("help"); }}>Why your invoice matters</a>}
  </div>;
}
function AnnouncementsWorkspace() {
  const blank: Partial<Announcement> = { title: "", body: "", category: "service_update", template: "service_update", status: "draft", audience: "all", starts_at: "", ends_at: "", priority: 0, cta_label: "", cta_url: "", animation: "fade", countdown: false };
  const [rows, setRows] = useState<Announcement[]>([]); const [form, setForm] = useState<Partial<Announcement>>(blank); const [editing, setEditing] = useState<string | null>(null); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [message, setMessage] = useState("");
  const load = () => listAnnouncements().then(({ data, error }) => { if (error) setMessage(error.message); else setRows(data ?? []); }).catch(error => setMessage(error instanceof Error ? error.message : "Unable to load announcements."));
  useEffect(() => { void load(); }, []);
  const set = (key: keyof Announcement, value: unknown) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => { event.preventDefault(); setMessage(""); const values = { ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null, priority: Number(form.priority || 0) }; const result = editing ? await updateAnnouncement(editing, values) : await createAnnouncement(values); if (result.error) setMessage(result.error.message); else { setForm(blank); setEditing(null); await load(); } };
  const edit = (row: Announcement) => { setEditing(row.id); setForm({ ...row, starts_at: row.starts_at?.slice(0, 16) || "", ends_at: row.ends_at?.slice(0, 16) || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (id: string) => { if (!window.confirm("Delete this announcement?")) return; const result = await deleteAnnouncement(id); if (result.error) setMessage(result.error.message); else setRows(current => current.filter(row => row.id !== id)); };
  const changeStatus = async (row: Announcement, status: Announcement["status"]) => { const result = await updateAnnouncement(row.id, { status }); if (result.error) setMessage(result.error.message); else setRows(current => current.map(item => item.id === row.id ? { ...item, status } : item)); };
  const visible = rows.filter(row => (filter === "all" || row.status === filter) && `${row.title} ${row.body} ${row.category}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="portal-card announcements-workspace">
    <div className="card-title"><div><h2>Announcements &amp; Updates</h2><p className="muted">Publish customer-facing updates without demo records or hardcoded audiences.</p></div><div className="stats-inline"><b>{rows.length}</b><span>Total</span><b>{rows.filter(row => row.status === "active").length}</b><span>Active</span></div></div>
    <form className="announcement-editor" onSubmit={save}>
      <h3>{editing ? "Edit announcement" : "Create announcement"}</h3>
      <div className="form-grid">
        <label>Quick template<select value={form.template} onChange={event => { const value = event.target.value; setForm(current => ({ ...current, ...announcementPresets[value], template: value as Announcement["template"] })); }}>{announcementTemplates.map(([category, template, label]) => <option key={template + category} value={template}>{label}</option>)}</select></label>
        <label>Title<input required maxLength={140} value={String(form.title || "")} onChange={event => set("title", event.target.value)} /></label>
        <label>Category<select value={form.category} onChange={event => set("category", event.target.value)}>{announcementTemplates.map(([category, template, label]) => <option key={`${category}-${template}-${label}`} value={category}>{label}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={event => set("status", event.target.value)}><option value="draft">Draft</option><option value="active">Active / publish</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
        <label>Priority<input type="number" min="0" max="100" value={String(form.priority ?? 0)} onChange={event => set("priority", Number(event.target.value))} /></label>
        <label>Animation<select value={form.animation} onChange={event => set("animation", event.target.value)}><option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option></select></label>
        <label>Starts<input type="datetime-local" value={String(form.starts_at || "")} onChange={event => set("starts_at", event.target.value)} /></label>
        <label>Ends<input type="datetime-local" value={String(form.ends_at || "")} onChange={event => set("ends_at", event.target.value)} /></label>
        <label>CTA label<input value={String(form.cta_label || "")} onChange={event => set("cta_label", event.target.value)} /></label>
        <label>CTA URL<input type="text" value={String(form.cta_url || "")} onChange={event => set("cta_url", event.target.value)} placeholder="#help or https://..." /></label>
      </div>
      <label>Message<textarea required maxLength={2000} rows={4} value={String(form.body || "")} onChange={event => set("body", event.target.value)} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.countdown)} onChange={event => set("countdown", event.target.checked)} /> Show optional countdown when an end date is set</label>
      <div className={`announcement-preview ${form.animation === "none" ? "" : form.animation}`} key={form.animation}>
        <span className="eyebrow orange">{String(form.template === "invoice_reminder" ? "A quick reminder" : form.category || "service update").replace("_", " ")}</span>
        <h3>{form.title || "Announcement title preview"}</h3>
        <p className={form.template === "invoice_reminder" ? "invoice-reminder-preview-copy" : ""}>{form.body || "Your announcement preview appears here."}</p>
        {form.cta_label && <button className={`button button-small ${form.template === "invoice_reminder" ? "announcement-invoice-cta" : ""}`} type="button">{form.cta_label}</button>}
        {form.template === "invoice_reminder" && <span className="announcement-help-link">Why your invoice matters</span>}
      </div>
      <button className="button" type="submit">{editing ? "Save changes" : "Create announcement"} <ArrowRight size={15} /></button>
      {editing && <button className="button button-secondary" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
      {message && <p className="form-error">{message}</p>}
    </form>
    <div className="toolbar"><input aria-label="Search announcements" placeholder="Search announcements" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Filter announcements" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option><option value="archived">Archived</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Announcement</th><th>Template</th><th>Priority</th><th>Status</th><th>Dates</th><th>Actions</th></tr></thead><tbody>{visible.length ? visible.map(row => <tr key={row.id}><td><b>{row.title}</b><small className="muted">{row.category}</small></td><td>{row.template}</td><td>{row.priority}</td><td><span className="status">{row.status}</span></td><td>{row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "Now"} – {row.ends_at ? new Date(row.ends_at).toLocaleDateString() : "Open"}</td><td><button className="text-button" onClick={() => edit(row)}>Edit</button>{row.status === "active" ? <button className="text-button" onClick={() => void changeStatus(row, "paused")}>Pause</button> : <button className="text-button" onClick={() => void changeStatus(row, "active")}>Publish</button>}<button className="text-button danger" onClick={() => void remove(row.id)}>Delete</button></td></tr>) : <tr><td colSpan={6}>No announcements yet. Create one above to publish a live update.</td></tr>}</tbody></table></div>
  </section>;
}
