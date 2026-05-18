import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, BadgeCheck, CalendarCheck, HeartPulse, ShieldCheck, Star, Stethoscope, Sparkles, MessageCircle, BookOpen, Brain, MapPin } from 'lucide-react';
import { blogPosts } from './blogData';
import { useAuth } from '../../context/AuthContext';
import api, { doctorAPI, blogAPI, authAPI } from '../../utils/api';
import PhoneInput from '../../components/common/PhoneInput';

const STORAGE_KEY = 'medicare_testimonials_v1';
const PUBLIC_POSTS_CACHE_KEY = 'medicare_public_posts_v1';
const PUBLIC_POSTS_CACHE_TS_KEY = 'medicare_public_posts_checked_at';
const PUBLIC_POSTS_CACHE_TTL_MS = 5 * 60 * 1000;

const defaultTestimonials = [
  {
    id: 1,
    name: 'Aarav Patel',
    role: 'Patient',
    rating: 5,
    message: 'Booking appointments is so quick and clear. The queue updates saved me a long wait.',
  },
  {
    id: 2,
    name: 'Dr. Nisha Menon',
    role: 'Doctor',
    rating: 5,
    message: 'Clinic workflow finally feels organized. Patient vitals and lab reports are all in one place.',
  },
  {
    id: 3,
    name: 'Priya Reddy',
    role: 'Patient',
    rating: 4,
    message: 'Love the lab test reminders. Reports are easy to see without hunting for files.',
  },
];

const symptomPresets = [
  'Fever, cough, body pain',
  'Chest discomfort, breathless on stairs',
  'Stomach pain, nausea after food',
  'Headache, blurred vision, fatigue',
  'Child fever with cough',
];

const serviceTabs = [
  { id: 'doctor', label: 'Doctor Appointments', description: 'Search specialists, compare experience, book in minutes.' },
  { id: 'lab', label: 'Lab Tests & Reports', description: 'Book lab tests and view verified reports.' },
  { id: 'pharmacy', label: 'Pharmacy & Prescriptions', description: 'Track prescriptions and pharmacy readiness.' },
];

const featuredDoctors = [
  {
    id: 1,
    name: 'Dr. Madhav Sai Nagar',
    specialty: 'General Physician',
    experience: '10 yrs',
    clinic: 'Sai Nagar Clinic',
    location: 'Rajapeth, Amravati',
    fee: 'INR 650',
    badges: ['Instant Confirmation', 'Available Today'],
  },
  {
    id: 2,
    name: 'Dr. Neha Kulkarni',
    specialty: 'Dermatologist',
    experience: '8 yrs',
    clinic: 'SkinCare Center',
    location: 'MG Road, Bengaluru',
    fee: 'INR 800',
    badges: ['Walk-in', 'Top Rated'],
  },
  {
    id: 3,
    name: 'Dr. Imran Qureshi',
    specialty: 'Cardiologist',
    experience: '12 yrs',
    clinic: 'Heartline Clinic',
    location: 'Hitech City, Hyderabad',
    fee: 'INR 1200',
    badges: ['Available Tomorrow', 'Senior Specialist'],
  },
];

const labPackages = [
  { id: 1, name: 'Full Body Checkup', price: 'INR 1499', tests: '70+ tests', time: 'Reports in 24 hrs' },
  { id: 2, name: 'Diabetes Monitoring', price: 'INR 599', tests: 'HbA1c + Glucose', time: 'Same day' },
  { id: 3, name: 'Women Wellness', price: 'INR 1299', tests: '55 tests', time: 'Reports in 24 hrs' },
];

const pharmacyItems = [
  { id: 1, name: 'Prescription Summary', detail: 'View medicines prescribed by doctors', eta: 'Available after visit' },
  { id: 2, name: 'Pharmacy Readiness', detail: 'Track status of assigned prescriptions', eta: 'Real-time updates' },
  { id: 3, name: 'Stock Alerts', detail: 'Low stock and expiry notifications', eta: 'Pharmacy dashboard' },
];

const providerRegistrationCards = [
  {
    id: 'doctor',
    title: 'Doctor Registration',
    desc: 'Create your doctor account, complete profile verification, and start managing clinics and appointments.',
  },
  {
    id: 'laboratory',
    title: 'Laboratory Registration',
    desc: 'Register your lab, upload compliance documents, and start receiving assigned test orders.',
  },
  {
    id: 'pharmacist',
    title: 'Pharmacist Registration',
    desc: 'Set up your pharmacy account, complete verification, and manage prescriptions and inventory.',
  },
];

const knowledgeBase = [
  {
    keywords: ['fever', 'cough', 'cold', 'body pain', 'sore throat'],
    specialty: 'General Physician',
    note: 'Likely viral or seasonal. A general physician can assess and guide next steps.',
  },
  {
    keywords: ['chest', 'breathless', 'palpitation', 'pressure'],
    specialty: 'Cardiologist',
    note: 'Chest discomfort or breathlessness should be reviewed by a cardiology specialist.',
  },
  {
    keywords: ['stomach', 'nausea', 'vomit', 'acid', 'bloating'],
    specialty: 'Gastroenterologist',
    note: 'Digestive symptoms can be evaluated for diet, acidity, or infection.',
  },
  {
    keywords: ['headache', 'blurred', 'vision', 'dizzy', 'migraine'],
    specialty: 'Neurologist',
    note: 'Persistent headaches or vision changes should be assessed by neurology.',
  },
  {
    keywords: ['child', 'baby', 'pediatric', 'fever'],
    specialty: 'Pediatrician',
    note: 'For children, a pediatric consult is the safest first option.',
  },
  {
    keywords: ['skin', 'rash', 'itch', 'acne'],
    specialty: 'Dermatologist',
    note: 'Skin concerns respond well to early dermatology guidance.',
  },
];

const buildRecommendations = (input) => {
  const normalized = input.toLowerCase();
  const matches = knowledgeBase.filter(item => item.keywords.some(k => normalized.includes(k)));
  if (matches.length) return matches.slice(0, 3);
  return [
    {
      keywords: [],
      specialty: 'General Physician',
      note: 'A general physician can guide you to the right specialist if needed.',
    },
  ];
};

const formatRecommendationText = (items) => {
  return items.map((item, idx) => `${idx + 1}. ${item.specialty} - ${item.note}`).join('\n');
};

const normalizeText = (value) => String(value || '').toLowerCase();

const pickSpecialtyFromText = (text, doctors) => {
  const t = normalizeText(text);
  const specialties = Array.from(new Set((doctors || []).map(d => d.specialization).filter(Boolean)));
  let best = '';
  let bestScore = 0;
  specialties.forEach((spec) => {
    const specLower = normalizeText(spec);
    if (!specLower) return;
    let score = 0;
    if (t.includes(specLower)) score += specLower.length + 10;
    specLower.split(/\s+/).forEach((word) => {
      if (word.length >= 4 && t.includes(word)) score += word.length;
    });
    if (score > bestScore) {
      bestScore = score;
      best = spec;
    }
  });
  return best;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [testimonials, setTestimonials] = useState(defaultTestimonials);
  const [review, setReview] = useState({ name: '', role: 'Patient', rating: 5, message: '' });

  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: 'Hi! Describe your symptoms and I will suggest the right doctor type and next step.' },
  ]);
  const [panelInput, setPanelInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [activeService, setActiveService] = useState('doctor');
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [contactOpen, setContactOpen] = useState(false);
  const [aiDoctors, setAiDoctors] = useState([]);
  const [aiSpecialty, setAiSpecialty] = useState('');
  const [doctorModal, setDoctorModal] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNudge, setAiNudge] = useState(true);
  const [publicPosts, setPublicPosts] = useState([]);
  const [otpModal, setOtpModal] = useState({ open: false, phone: '', otp: '', sent: false, loading: false });

  useEffect(() => {
    document.title = 'MediCare Pro - Smart Healthcare Platform';
  }, []);

  const openBookingFlow = () => {
    if (user && user.role === 'patient') {
      navigate('/patient/book');
      return;
    }
    setOtpModal({ open: true, phone: '', otp: '', sent: false, loading: false });
  };

  const sendOtp = async () => {
    if (!otpModal.phone) {
      toast.error('Phone number required');
      return;
    }
    setOtpModal((s) => ({ ...s, loading: true }));
    try {
      await authAPI.sendOtp(otpModal.phone, 'login');
      toast.success('OTP sent');
      setOtpModal((s) => ({ ...s, sent: true, loading: false }));
    } catch {
      setOtpModal((s) => ({ ...s, loading: false }));
    }
  };

  const verifyOtp = async () => {
    if (!otpModal.otp) {
      toast.error('Enter OTP');
      return;
    }
    setOtpModal((s) => ({ ...s, loading: true }));
    try {
      const { data } = await authAPI.loginOtp(otpModal.phone, otpModal.otp, 'patient');
      login(data.user, data.tokens);
      setOtpModal({ open: false, phone: '', otp: '', sent: false, loading: false });
      navigate('/patient/book');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'NOT_REGISTERED') {
        toast.error('Please register to continue');
        setOtpModal({ open: false, phone: '', otp: '', sent: false, loading: false });
        navigate(`/register?role=patient&phone=${encodeURIComponent(otpModal.phone)}`);
      } else {
        setOtpModal((s) => ({ ...s, loading: false }));
      }
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          setTestimonials(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testimonials));
  }, [testimonials]);

  useEffect(() => {
    const cachedPosts = readCachedPosts();
    if (cachedPosts.length) {
      setPublicPosts(cachedPosts);
    }

    if (cachedPosts.length && !shouldRefreshPosts()) {
      return;
    }

    let isMounted = true;
    blogAPI.listPublic()
      .then(({ data }) => {
        const list = data?.posts || [];
        if (isMounted) {
          setPublicPosts(list);
          cachePosts(list);
        }
      })
      .catch(() => {})
      .finally(() => {});
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const hide = () => mounted && setAiNudge(false);
    const show = () => mounted && setAiNudge(true);
    const firstTimer = setTimeout(hide, 7000);
    const interval = setInterval(() => {
      show();
      setTimeout(hide, 5000);
    }, 30000);
    return () => {
      mounted = false;
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, []);

  const featuredPosts = useMemo(() => {
    const source = publicPosts.length ? publicPosts : blogPosts;
    return source.slice(0, 3);
  }, [publicPosts]);

  const submitReview = () => {
    if (!review.name || !review.message) return;
    const next = {
      id: Date.now(),
      name: review.name,
      role: review.role,
      rating: Number(review.rating) || 5,
      message: review.message,
    };
    setTestimonials(prev => [next, ...prev]);
    setReview({ name: '', role: 'Patient', rating: 5, message: '' });
  };

  const loadAiDoctors = async (textForMatch) => {
    try {
      const { data } = await doctorAPI.search({});
      const list = data?.doctors || [];
      if (!list.length) {
        setAiDoctors([]);
        setAiSpecialty('');
        return;
      }
      const match = pickSpecialtyFromText(textForMatch, list);
      let filtered = list;
      if (match) {
        const matchLower = normalizeText(match);
        filtered = list.filter((d) => {
          const spec = normalizeText(d.specialization);
          const depts = normalizeText(d.departments);
          return spec.includes(matchLower) || depts.includes(matchLower);
        });
      }
      filtered = filtered
        .slice()
        .sort((a, b) => Number(b.experience_years || 0) - Number(a.experience_years || 0))
        .slice(0, 4);
      setAiSpecialty(match || 'Suggested Doctors');
      setAiDoctors(filtered);
    } catch {
      setAiDoctors([]);
      setAiSpecialty('');
    }
  };

  const handleAiSend = async (value) => {
    const text = value.trim();
    if (!text) return;
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    try {
      const { data } = await api.post('/ai/assist', { message: text });
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data?.reply || 'I could not generate a response right now.',
      };
      setMessages(prev => [...prev, assistantMsg]);
      await loadAiDoctors(data?.reply || text);
    } catch {
      const fallback = {
        id: Date.now() + 2,
        role: 'assistant',
        text: 'AI assistant is unavailable right now. Please try again in a moment.',
      };
      setMessages(prev => [...prev, fallback]);
      await loadAiDoctors(text);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contact', {
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        subject: contactForm.subject,
        message: contactForm.message,
      });
      toast.success('Message sent. Our team will contact you soon.');
      setContactForm({ name: '', email: '', phone: '', subject: '', message: '' });
      setContactOpen(false);
    } catch {
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand" onClick={() => navigate('/')}>
          <span className="landing-brand-mark">Medi</span>Care Pro
        </div>
        <nav className="landing-links">
          <a href="#features">Features</a>
          <button type="button" className="link-button" onClick={() => setAiOpen(true)}>AI Assist</button>
          <a href="#testimonials">Patient Stories</a>
          <a href="#contact">Contact</a>
          <Link to="/blog">Blog</Link>
        </nav>
        <div className="landing-actions">
          <a href="#provider-registration" className="btn btn-outline">Register</a>
          {user ? (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
          ) : (
              <Link to="/login" className="btn btn-primary">Login </Link>
            )}
          </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="hero-badge"><Sparkles size={16} /> Smart care that feels personal</div>
          <h1>Book, consult, and manage care across doctors, labs, and pharmacies in one place.</h1>
          <p>
            MediCare Pro brings appointment queues, verified clinics, lab orders, and pharmacy prescriptions into a single, secure platform. Built for patients, trusted by providers.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Get Started <ArrowRight size={16} /></button>
            <Link to="/blog" className="btn btn-outline btn-lg">Explore Health Guides</Link>
          </div>
          <div className="hero-stats">
            <div>
              <h3>4+ Roles</h3>
              <p>Doctor, Lab, Pharmacy, Patient</p>
            </div>
            <div>
              <h3>Live Queue</h3>
              <p>Real-time slot updates</p>
            </div>
            <div>
              <h3>Secure</h3>
              <p>Verified clinics & reports</p>
            </div>
          </div>
        </div>
        <div className="landing-hero-card">
          <div className="hero-card-top">
            <div>
              <h4>Today's Next Available</h4>
              <p>AI matched specialists near you</p>
            </div>
            <div className="hero-avatar">AI</div>
          </div>
          <div className="hero-card-list">
            <div className="hero-card-item">
              <div>
                <h5>Dr. Priya S.</h5>
                <p>Cardiology - 12 yrs exp</p>
              </div>
              <span className="badge badge-success">Available</span>
            </div>
            <div className="hero-card-item">
              <div>
                <h5>City Lab Diagnostics</h5>
                <p>Lab test slot - 2 km away</p>
              </div>
              <span className="badge badge-primary">Verified</span>
            </div>
            <div className="hero-card-item">
              <div>
                <h5>PharmaPlus</h5>
                <p>Prescription ready</p>
              </div>
              <span className="badge badge-warning">In stock</span>
            </div>
          </div>
          <div className="hero-card-footer">
              <button className="btn btn-secondary" onClick={() => navigate('/login')}>Book Now</button>
            <button className="btn btn-ghost" onClick={() => navigate('/blog')}>See Tips</button>
          </div>
        </div>
      </section>

      <section className="landing-section service-section">
        <div className="section-header">
          <h2>Book care the way modern clinics do</h2>
          <p>Pick a service to preview what patients see before they book.</p>
        </div>

        <div className="service-tabs">
          {serviceTabs.map((tab) => (
            <button
              key={tab.id}
              className={`service-tab ${activeService === tab.id ? 'active' : ''}`}
              onClick={() => setActiveService(tab.id)}
            >
              <div className="service-tab-title">{tab.label}</div>
              <div className="service-tab-desc">{tab.description}</div>
            </button>
          ))}
        </div>

        <div className="service-panel">
          {activeService === 'doctor' && (
            <div className="service-panel-inner">
              <div className="service-panel-header">
                <div>
                  <h3>All Doctors</h3>
                  <p>Filters like specialty, experience, and availability.</p>
                </div>
                <button className="btn btn-outline" onClick={openBookingFlow}>Book Appointment</button>
              </div>
              <div className="service-chip-row">
                {['General Physician', 'Pediatrics', 'Dental', 'Dermatology', 'Cold & Fever', '5+ Experience'].map((chip) => (
                  <span key={chip} className="chip">{chip}</span>
                ))}
              </div>
              <div className="service-card-grid">
                {featuredDoctors.map((doc) => (
                  <div key={doc.id} className="service-card">
                    <div className="service-card-top">
                      <div className="service-avatar">{doc.name.slice(0, 1)}</div>
                      <div>
                        <div className="service-card-title">{doc.name}</div>
                        <div className="service-card-sub">{doc.specialty} - {doc.experience}</div>
                      </div>
                    </div>
                    <div className="service-card-body">
                      <div className="service-card-row">{doc.clinic}</div>
                      <div className="service-card-row">{doc.location}</div>
                      <div className="service-badges">
                        {doc.badges.map((b) => (
                          <span key={b} className="badge badge-primary">{b}</span>
                        ))}
                      </div>
                    </div>
                    <div className="service-card-footer">
                      <span className="service-fee">{doc.fee}</span>
                      <button className="btn btn-primary btn-sm" onClick={openBookingFlow}>Book Visit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeService === 'lab' && (
            <div className="service-panel-inner">
              <div className="service-panel-header">
                <div>
                  <h3>Lab Tests & Reports</h3>
                  <p>Book lab tests and track verified reports.</p>
                </div>
                <button className="btn btn-outline" onClick={() => navigate('/login')}>View Labs</button>
              </div>
              <div className="service-card-grid">
                {labPackages.map((pkg) => (
                  <div key={pkg.id} className="service-card">
                    <div className="service-card-title">{pkg.name}</div>
                    <div className="service-card-sub">{pkg.tests}</div>
                    <div className="service-card-row">{pkg.time}</div>
                    <div className="service-card-footer">
                      <span className="service-fee">{pkg.price}</span>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Book Now</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeService === 'pharmacy' && (
            <div className="service-panel-inner">
              <div className="service-panel-header">
                <div>
                  <h3>Pharmacy & Prescriptions</h3>
                  <p>Manage prescriptions and pharmacy readiness.</p>
                </div>
                <button className="btn btn-outline" onClick={() => navigate('/login')}>View Prescriptions</button>
              </div>
              <div className="service-card-grid">
                {pharmacyItems.map((item) => (
                  <div key={item.id} className="service-card">
                    <div className="service-card-title">{item.name}</div>
                    <div className="service-card-row">{item.detail}</div>
                    <div className="service-card-sub">{item.eta}</div>
                    <div className="service-card-footer">
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Open Pharmacy</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="section-header">
          <h2>Everything clinics need, everything patients expect</h2>
          <p>Inspired by real hospital workflows with a modern, simple interface.</p>
        </div>
        <div className="feature-grid">
          {[
            { icon: CalendarCheck, title: 'Smart Appointments', desc: 'Queue number, time slot reminders, and real-time status updates.' },
            { icon: ShieldCheck, title: 'Verified Providers', desc: 'Admin approval for doctors, labs, and pharmacies.' },
            { icon: HeartPulse, title: 'Patient Vitals', desc: 'Vitals & history shown to doctors during consult.' },
            { icon: MapPin, title: 'Near Me Search', desc: 'Find clinics, labs, and pharmacies using GPS.' },
            { icon: MessageCircle, title: 'Live Notifications', desc: 'Instant alerts for lab reports, prescriptions, and queue progress.' },
            { icon: BadgeCheck, title: 'Multi-role Dashboards', desc: 'Dedicated dashboards for every role and workflow.' },
          ].map((f, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon"><f.icon size={20} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {aiOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg ai-modal">
            <div className="modal-header">
              <h2>AI Chat Doctor Suggest Assistant</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setAiOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                Describe symptoms, get recommended specialists, and move directly to booking.
              </div>
              <div className="ai-grid">
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div>
                      <h3>Symptom Input</h3>
                      <p>AI-powered suggestions (live)</p>
                    </div>
                    <Brain size={20} />
                  </div>
                  <div className="ai-suggestions">
                    {symptomPresets.map(preset => (
                      <button key={preset} className="chip" onClick={() => setPanelInput(preset)}>{preset}</button>
                    ))}
                  </div>
                  <div className="ai-input">
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Type symptoms like: fever, cough, sore throat"
                      value={panelInput}
                      onChange={(e) => setPanelInput(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={() => { handleAiSend(panelInput); setPanelInput(''); }}>Get Suggestions</button>
                  </div>
                  <div className="ai-cta">
                    <p>Ready to book with a specialist?</p>
                    <a href="#provider-registration" className="btn btn-outline">Provider Signup</a>
                  </div>
                </div>

                <div className="ai-chat">
                  <div className="ai-chat-header">
                    <Stethoscope size={18} /> AI Doctor Assistant
                  </div>
                  <div className="ai-chat-body">
                    {messages.map(msg => (
                      <div key={msg.id} className={`ai-message ${msg.role}`}>
                        <div className="ai-bubble">{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ai-chat-footer">
                    <input
                      className="form-input"
                      placeholder="Ask about symptoms or next steps"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiSend(chatInput); setChatInput(''); } }}
                    />
                    <button className="btn btn-primary" onClick={() => { handleAiSend(chatInput); setChatInput(''); }}><ArrowRight size={15} /></button>
                  </div>
                </div>
              </div>

              {aiDoctors.length > 0 && (
                <div className="ai-doctors">
                  <div className="ai-doctors-header">
                    <h3>{aiSpecialty || 'Suggested Doctors'}</h3>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/login')}>See All Doctors</button>
                  </div>
                  <div className="service-card-grid">
                    {aiDoctors.map((doc) => (
                      <div key={doc.id} className="service-card">
                        <div className="service-card-top">
                          <div className="service-avatar">
                            {doc.profile_image ? (
                              <img src={doc.profile_image} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                            ) : (
                              (doc.name || 'D').slice(0, 1)
                            )}
                          </div>
                          <div>
                            <div className="service-card-title">{doc.name}</div>
                            <div className="service-card-sub">{doc.specialization || 'Specialist'}{doc.experience_years ? ` - ${doc.experience_years} yrs` : ''}</div>
                          </div>
                        </div>
                        <div className="service-card-row">{doc.clinic_name || 'Clinic'} - {doc.city || 'City'}</div>
                        <div className="service-card-footer">
                          <button className="btn btn-outline btn-sm" onClick={() => setDoctorModal(doc)}>View Profile</button>
                          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Book</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section id="testimonials" className="landing-section">
        <div className="section-header">
          <h2>Patient Stories & Clinic Trust</h2>
          <p>Collect and display feedback to build trust with new patients.</p>
        </div>
        <div className="testimonial-grid">
          <div className="testimonial-form">
            <h3>Share your feedback</h3>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input className="form-input" value={review.name} onChange={(e) => setReview(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">I am a</label>
                <select className="form-select" value={review.role} onChange={(e) => setReview(prev => ({ ...prev, role: e.target.value }))}>
                  <option>Patient</option>
                  <option>Doctor</option>
                  <option>Laboratory</option>
                  <option>Pharmacist</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Star Rating</label>
                <select className="form-select" value={review.rating} onChange={(e) => setReview(prev => ({ ...prev, rating: e.target.value }))}>
                  {[5, 4, 3, 2].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Your Review</label>
              <textarea className="form-textarea" rows={4} value={review.message} onChange={(e) => setReview(prev => ({ ...prev, message: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={submitReview}>Submit Feedback</button>
          </div>

          <div className="testimonial-list">
            {testimonials.map(item => (
              <div key={item.id} className="testimonial-card">
                <div className="testimonial-header">
                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.role}</p>
                  </div>
                  <div className="testimonial-rating">
                    {Array.from({ length: item.rating }).map((_, idx) => (
                      <Star key={idx} size={14} fill="#F59E0B" color="#F59E0B" />
                    ))}
                  </div>
                </div>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-header">
          <h2>Health Guides & Clinic Updates</h2>
          <p>SEO-ready public pages, doctor articles, and health guides.</p>
        </div>
        <div className="blog-grid">
          {featuredPosts.map(post => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="blog-card">
              <div className="blog-cover" style={{ background: post.cover || post.cover_image || 'linear-gradient(135deg, #0A7EA4 0%, #00B894 100%)' }} />
              <div className="blog-body">
                <span className="blog-category">{post.category}</span>
                <h3>{post.title}</h3>
                <p>{post.excerpt || post.summary}</p>
                <div className="blog-meta">
                  <span>{post.author || post.author_name}</span>
                  <span>-</span>
                  <span>{post.readTime || (post.published_at ? 'Published' : 'Draft')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/blog" className="btn btn-outline">View All Articles</Link>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <h2>Ready to upgrade your clinic experience?</h2>
          <p>Launch verified onboarding, live queue updates, and smart patient communication.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Start Now</button>
      </section>

      <section id="provider-registration" className="landing-section">
        <div className="section-header">
          <h2>Register Your Healthcare Service</h2>
          <p>Choose the registration page that matches your service. Patients and staff can use the universal login page.</p>
        </div>
        <div className="service-card-grid">
          {providerRegistrationCards.map((card) => (
            <div key={card.id} className="service-card">
              <div className="service-card-title">{card.title}</div>
              <div className="service-card-row">{card.desc}</div>
              <div className="service-card-footer">
                <Link to={`/register?role=${card.id}`} className="btn btn-primary btn-sm">
                  Open Registration
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Existing users, patients, and staff members can continue with the <Link to="/login">login</Link>.
        </div>
      </section>

      <section id="contact" className="landing-section">
        <div className="section-header">
          <h2>Contact Now</h2>
          <p>Reach our support team for onboarding, help, or partnerships.</p>
        </div>
        <div className="contact-grid">
          <div className="contact-card">
            <h3>Quick Contact</h3>
            <div className="contact-item">
              <span>Support Email</span>
              <a href="mailto:support@medicarepro.com">support@medicarepro.com</a>
            </div>
            <div className="contact-item">
              <span>Phone</span>
              <a href="tel:+911234567890">+91 12345 67890</a>
            </div>
            <div className="contact-item">
              <span>Working Hours</span>
              <p>Mon - Sat, 9:00 AM to 7:00 PM</p>
            </div>
            <div className="contact-note">For urgent medical issues, please contact local emergency services.</div>
          </div>

          <div className="contact-card contact-cta">
            <h3>Start a Conversation</h3>
            <p>Tell us what you need for onboarding support, clinic partnership, lab collaboration, or platform help.</p>
            <div className="contact-actions">
              <button className="btn btn-primary" onClick={() => setContactOpen(true)}>Send Message</button>
              <a href="#provider-registration" className="btn btn-outline">Begin Onboarding</a>
            </div>
            <div className="contact-note">We usually reply within one business day.</div>
          </div>
        </div>
      </section>

      {contactOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Contact Support</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setContactOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleContactSubmit} className="contact-modal-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <input
                      className="form-input"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <PhoneInput
                        value={contactForm.phone}
                        onChange={(val) => setContactForm({ ...contactForm, phone: val })}
                      />
                    </div>
                  <div className="form-group">
                    <label className="form-label">Topic</label>
                    <input
                      className="form-input"
                      placeholder="Onboarding, Support, Partnership"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-footer" style={{ padding: 0 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setContactOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" type="submit">Send Message</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <footer className="landing-footer mega-footer">
        <div className="footer-brand">
          <h4>MediCare Pro</h4>
          <p>Smart care coordination for patients, clinics, labs, and pharmacies.</p>
          <p style={{ marginTop: 8 }}>HQ: Bengaluru-Support: Mon-Sat, 9:00 AM - 7:00 PM</p>
          <div className="footer-mini-links">
            <Link to="/blog">Blog</Link>
            <Link to="/login">Login</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
        <div className="footer-columns">
          <div className="footer-col">
            <h5>Help Center</h5>
            <Link to="/faq">FAQs</Link>
            <Link to="/contact">Contact Support</Link>
            <Link to="/policies">Our Policies</Link>
          </div>
          <div className="footer-col">
            <h5>Legal</h5>
            <Link to="/terms">Terms of Use</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/grievance">Grievance Redressal</Link>
            <Link to="/refunds">Cancellation & Refund</Link>
            <Link to="/security">Security at MediCare Pro</Link>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <Link to="/about">Overview</Link>
            <Link to="/corporate-plans">Tailored Corporate Plans</Link>
            <Link to="/testimonials">Patient Stories</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/medical-travel">Medical Value Travel</Link>
            <Link to="/beliefs">MediCare Pro Beliefs</Link>
          </div>
          <div className="footer-col">
            <h5>For Providers</h5>
            <Link to="/register?role=doctor">Doctor Registration</Link>
            <Link to="/register?role=laboratory">Laboratory Registration</Link>
            <Link to="/register?role=pharmacist">Pharmacist Registration</Link>
            <Link to="/corporate-plans">Corporate Plans</Link>
          </div>
          <div className="footer-col">
            <h5>Download App</h5>
            <div className="footer-apps">
              <button className="footer-badge">App Store</button>
              <button className="footer-badge">Google Play</button>
            </div>
          </div>
          <div className="footer-col">
            <h5>Follow Us</h5>
            <div className="footer-social">
              <a href="#" aria-label="Facebook">FB</a>
              <a href="#" aria-label="Instagram">IG</a>
              <a href="#" aria-label="LinkedIn">IN</a>
              <a href="#" aria-label="YouTube">YT</a>
            </div>
          </div>
        </div>
      </footer>
      <button type="button" className="ai-fab" onClick={() => setAiOpen(true)} title="AI Assistant">
        <Brain size={18} />
        <span>AI Assist</span>
        {aiNudge && <span className="ai-fab-ping" />}
      </button>
      {aiNudge && (
        <div className="ai-fab-tooltip">
          Need help? Try the AI Assistant.
        </div>
      )}
      {doctorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Doctor Profile</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDoctorModal(null)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div className="service-avatar">
                  {doctorModal.profile_image ? (
                    <img src={doctorModal.profile_image} alt={doctorModal.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  ) : (
                    (doctorModal.name || 'D').slice(0, 1)
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{doctorModal.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {doctorModal.specialization || 'Specialist'}{doctorModal.experience_years ? ` - ${doctorModal.experience_years} yrs` : ''}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Clinic:</strong> {doctorModal.clinic_name || 'Clinic'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Location:</strong> {doctorModal.address || doctorModal.city || '-'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Consultation Starts At:</strong> {doctorModal.consultation_fee ? `INR ${doctorModal.consultation_fee}` : 'Fee N/A'}
              </div>
              {doctorModal.bio && (
                <div style={{ fontSize: 13 }}>
                  <strong>About:</strong> {doctorModal.bio}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDoctorModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={openBookingFlow}>Book Appointment</button>
            </div>
          </div>
        </div>
      )}
      {otpModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Verify Phone to Book</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setOtpModal({ open: false, phone: '', otp: '', sent: false, loading: false })}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <PhoneInput
                    value={otpModal.phone}
                    onChange={(val) => setOtpModal((s) => ({ ...s, phone: val }))}
                    disabled={otpModal.sent}
                  />
              </div>
              {otpModal.sent && (
                <div className="form-group">
                  <label className="form-label">OTP</label>
                  <input
                    className="form-input"
                    placeholder="Enter OTP"
                    value={otpModal.otp}
                    onChange={(e) => setOtpModal((s) => ({ ...s, otp: e.target.value }))}
                  />
                </div>
              )}
              <div className="form-hint">We will send an OTP to verify your phone.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOtpModal({ open: false, phone: '', otp: '', sent: false, loading: false })}>Cancel</button>
              {!otpModal.sent ? (
                <button className="btn btn-primary" onClick={sendOtp} disabled={otpModal.loading}>
                  {otpModal.loading ? 'Sending...' : 'Send OTP'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={verifyOtp} disabled={otpModal.loading}>
                  {otpModal.loading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
  const readCachedPosts = () => {
    try {
      const raw = localStorage.getItem(PUBLIC_POSTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const cachePosts = (posts) => {
    try {
      localStorage.setItem(PUBLIC_POSTS_CACHE_KEY, JSON.stringify(posts || []));
      localStorage.setItem(PUBLIC_POSTS_CACHE_TS_KEY, String(Date.now()));
    } catch {
      // Ignore storage failures for public content cache.
    }
  };

  const shouldRefreshPosts = () => {
    try {
      const lastChecked = Number(localStorage.getItem(PUBLIC_POSTS_CACHE_TS_KEY) || 0);
      return !lastChecked || (Date.now() - lastChecked) > PUBLIC_POSTS_CACHE_TTL_MS;
    } catch {
      return true;
    }
  };
