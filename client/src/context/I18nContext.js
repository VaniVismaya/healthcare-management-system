import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const I18nContext = createContext(null);

const translations = {
  en: {
    common: {
      dashboard: 'Dashboard',
      login: 'Login',
      register: 'Register',
      logout: 'Logout',
      phone: 'Phone Number',
      phoneOrEmail: 'Phone or Email',
      password: 'Password',
      otp: 'OTP',
      sendOtp: 'Send OTP',
      verifyOtp: 'Verify OTP',
      welcomeBack: 'Welcome Back',
      backToRole: 'Back to role selection',
      adminLogin: 'Admin Login',
      changeNumber: 'Change Number',
      createAccount: 'Create Account',
      loginAs: 'Login as',
      registerAs: 'Register as',
    },
    roleSelect: {
      title: 'Who are you?',
      subtitle: 'Select your role to continue',
      patient: 'Patient',
      doctor: 'Doctor',
      laboratory: 'Laboratory',
      pharmacist: 'Pharmacist',
      patientDesc: 'Book appointments & view records',
      doctorDesc: 'Manage appointments & patients',
      labDesc: 'Manage tests & reports',
      pharmacistDesc: 'Manage medicines & stock',
    },
    nav: {
      admin: {
        dashboard: 'Overview',
        verifications: 'Verification Requests',
        users: 'User Registry',
        clinics: 'Clinic Directory',
        plans: 'Plans & Billing',
        messages: 'Contact Inbox',
        articles: 'Article Approvals',
        announcements: 'System Announcements',
        reports: 'Insights & Reports',
        auditLogs: 'Audit Trail',
      },
      doctor: {
        dashboard: 'Dashboard',
        appointments: 'Appointments',
        labOrders: 'Lab Orders',
        clinics: 'My Clinics',
        schedule: 'Schedule',
        guestDoctors: 'Guest Doctors',
        articles: 'Articles',
        profile: 'Profile',
      },
      patient: {
        dashboard: 'Dashboard',
        book: 'Book Appointment',
        clinics: 'Clinics Near Me',
        appointments: 'My Appointments',
        prescriptions: 'Prescriptions',
        labOrders: 'Lab Results',
        profile: 'My Profile',
      },
      lab: {
        dashboard: 'Dashboard',
        orders: 'Lab Orders',
        reports: 'Reports',
        tests: 'Tests & Packages',
        profile: 'Lab Profile',
      },
      pharmacist: {
        dashboard: 'Dashboard',
        prescriptions: 'Prescriptions',
        inventory: 'Medicine Inventory',
        alerts: 'Stock Alerts',
        profile: 'Pharmacy Profile',
      },
      receptionist: {
        dashboard: 'Dashboard',
        appointments: 'Appointments',
      },
    },
  },
  hi: {
    common: {
      dashboard: 'डैशबोर्ड',
      login: 'लॉगिन',
      register: 'रजिस्टर',
      logout: 'लॉगआउट',
      phone: 'फ़ोन नंबर',
      phoneOrEmail: 'फ़ोन या ईमेल',
      password: 'पासवर्ड',
      otp: 'ओटीपी',
      sendOtp: 'ओटीपी भेजें',
      verifyOtp: 'ओटीपी सत्यापित करें',
      welcomeBack: 'वापसी पर स्वागत है',
      backToRole: 'भूमिका चयन पर वापस जाएँ',
      adminLogin: 'एडमिन लॉगिन',
      changeNumber: 'नंबर बदलें',
      createAccount: 'खाता बनाएँ',
      loginAs: 'लॉगिन करें',
      registerAs: 'रजिस्टर करें',
    },
    roleSelect: {
      title: 'आप कौन हैं?',
      subtitle: 'जारी रखने के लिए भूमिका चुनें',
      patient: 'रोगी',
      doctor: 'डॉक्टर',
      laboratory: 'लैब',
      pharmacist: 'फार्मासिस्ट',
      patientDesc: 'अपॉइंटमेंट बुक करें और रिकॉर्ड देखें',
      doctorDesc: 'अपॉइंटमेंट और मरीज प्रबंधन',
      labDesc: 'टेस्ट और रिपोर्ट प्रबंधन',
      pharmacistDesc: 'दवा और स्टॉक प्रबंधन',
    },
    nav: {
      admin: {
        dashboard: 'डैशबोर्ड',
        verifications: 'सत्यापन',
        users: 'सभी उपयोगकर्ता',
        clinics: 'क्लिनिक',
        plans: 'सब्सक्रिप्शन प्लान',
        messages: 'संपर्क संदेश',
        articles: 'Articles',
        announcements: 'घोषणाएँ',
        reports: 'रिपोर्ट्स',
        auditLogs: 'ऑडिट लॉग',
      },
      doctor: {
        dashboard: 'डैशबोर्ड',
        appointments: 'अपॉइंटमेंट',
        labOrders: 'लैब ऑर्डर',
        clinics: 'मेरी क्लिनिक',
        schedule: 'शेड्यूल',
        guestDoctors: 'गेस्ट डॉक्टर्स',
        articles: 'Articles',
        profile: 'प्रोफ़ाइल',
      },
      patient: {
        dashboard: 'डैशबोर्ड',
        book: 'अपॉइंटमेंट बुक करें',
        clinics: 'नजदीकी क्लिनिक',
        appointments: 'मेरे अपॉइंटमेंट',
        prescriptions: 'प्रिस्क्रिप्शन',
        labOrders: 'लैब रिपोर्ट',
        profile: 'मेरी प्रोफ़ाइल',
      },
      lab: {
        dashboard: 'डैशबोर्ड',
        orders: 'लैब ऑर्डर',
        reports: 'रिपोर्ट्स',
        tests: 'टेस्ट और पैकेज',
        profile: 'लैब प्रोफ़ाइल',
      },
      pharmacist: {
        dashboard: 'डैशबोर्ड',
        prescriptions: 'प्रिस्क्रिप्शन',
        inventory: 'मेडिसिन इन्वेंटरी',
        alerts: 'स्टॉक अलर्ट',
        profile: 'फार्मेसी प्रोफ़ाइल',
      },
      receptionist: {
        dashboard: 'डैशबोर्ड',
        appointments: 'अपॉइंटमेंट',
      },
    },
  },
};

const getValue = (obj, path) => {
  const parts = path.split('.');
  let current = obj;
  for (const p of parts) {
    if (!current || typeof current !== 'object') return null;
    current = current[p];
  }
  return current;
};

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = useMemo(() => {
    return (key) => getValue(translations[lang], key) || getValue(translations.en, key) || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

