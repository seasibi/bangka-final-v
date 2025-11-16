import { useState, useRef, useEffect } from 'react';
import { FaBook, FaQuestionCircle, FaEnvelope, FaPhone, FaSearch, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedGuide, setSelectedGuide] = useState(null);

  const faqCategories = [
    { id: 'all', label: 'All Topics' },
    { id: 'fisherfolk', label: 'Fisherfolk Management' },
    { id: 'boat', label: 'Boat Registry' },
    { id: 'tracking', label: 'BirukBilug Tracking' },
    { id: 'reports', label: 'Reports' },
    { id: 'users', label: 'User Management' },
  ];

  const faqs = [
    {
      category: 'fisherfolk',
      question: 'How do I view fisherfolk records province-wide?',
      answer:
        'Go to Fisherfolk Management. Use the filters and search to view fisherfolk across all municipalities within the province.',
    },
    {
      category: 'boat',
      question: 'How do I review registered boats by municipality?',
      answer:
        'Open Boat Registry Management and use the search and filters to view boats per municipality or MFBR number.',
    },
    {
      category: 'tracking',
      question: 'How does BirukBilug tracking support provincial monitoring?',
      answer:
        'Use BirukBilug Tracking to see all tracked boats on the map. You can search by MFBR and monitor movement across municipal boundaries.',
    },
    {
      category: 'reports',
      question: 'What reports are useful for provincial planning?',
      answer:
        'Use Report Generation to build summary reports by municipality, gear type, or livelihood to support provincial fisheries planning.',
    },
    {
      category: 'users',
      question: 'Can I help municipal users with data issues?',
      answer:
        'Coordinate with the system administrator for user management. As provincial agriculturist you can review data trends and coordinate corrections with municipalities.',
    },
  ];

  const guides = [
    {
      icon: <FaBook className="text-blue-600 text-3xl" />,
      title: 'Dashboard Overview',
      description: 'Understand the provincial dashboard cards and charts.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Dashboard Overview</h3>
          <p className="text-gray-600">
            The provincial dashboard shows active and total fisherfolk and boats, plus analytics by sex, livelihood, municipality,
            trackers, and violations. Use the date range filter to focus on specific periods.
          </p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-indigo-600 text-3xl" />,
      title: 'Fisherfolk Management',
      description: 'Review and analyze fisherfolk records across municipalities.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Fisherfolk Management</h3>
          <p className="text-gray-600">
            Use Fisherfolk Management to view records submitted by all municipalities. Filter by municipality, registration number,
            status, or date added to support validation and planning.
          </p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-teal-600 text-3xl" />,
      title: 'Boat Registry Management',
      description: 'Monitor registered boats at the provincial level.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Boat Registry Management</h3>
          <p className="text-gray-600">
            Use Boat Registry Management to see all registered boats. You can filter by municipality, MFBR number, status, and
            boat type to identify coverage and gaps.
          </p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-yellow-600 text-3xl" />,
      title: 'BirukBilug Tracking',
      description: 'Use trackers for compliance and safety monitoring.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">BirukBilug Tracking</h3>
          <p className="text-gray-600">
            The BirukBilug Tracking map lets you monitor active trackers across the province. Use MFBR search and boundary filters
            to see movements between municipalities and sensitive zones.
          </p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-cyan-600 text-3xl" />,
      title: 'Report Generation',
      description: 'Create provincial-level summary reports.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Report Generation</h3>
          <p className="text-gray-600">
            Use Report Generation to build fisherfolk, boat, and violation reports grouped by municipality or other fields.
            Export these to PDF/Excel for meetings and official reporting.
          </p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-gray-600 text-3xl" />,
      title: 'Utilities',
      description: 'Imports, backups, and other provincial tools.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Utilities</h3>
          <p className="text-gray-600">
            Provincial utilities include tools such as imports and backups (if enabled). Coordinate with system administrators
            before doing bulk changes to avoid data loss.
          </p>
        </div>
      ),
    },
  ];

  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const updateActiveIndex = () => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children);
    if (!children.length) return;
    const containerRect = el.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let best = 0;
    let bestDist = Infinity;
    children.forEach((child, i) => {
      const r = child.getBoundingClientRect();
      const childCenter = r.left + r.width / 2;
      const dist = Math.abs(childCenter - containerCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveIndex(best);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => updateActiveIndex();
    el.addEventListener('scroll', onScroll, { passive: true });

    const onWheel = (e) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    let sx = 0,
      sy = 0;
    const onTouchStart = (e) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
    };
    const onTouchMove = (e) => {
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - sx);
      const dy = Math.abs(t.clientY - sy);
      if (dx > dy) e.preventDefault();
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    window.addEventListener('resize', updateActiveIndex);
    updateActiveIndex();

    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', updateActiveIndex);
    };
  }, [scrollRef.current]);

  const q = searchQuery.trim().toLowerCase();
  const filteredGuides = guides.filter((guide) => {
    return q === '' || guide.title.toLowerCase().includes(q) || guide.description.toLowerCase().includes(q);
  });

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesQuery = q === '' || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="h-full bg-gray-50" style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="h-full px-4 py-7" style={{ fontFamily: "Montserrat, sans-serif" }}>
        <div className="flex items-center mb-3">
          {/* back button */}
          <button type="button" onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              HELP CENTER
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Use this page to learn how to use the system
            </p>
          </div>


      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-2xl">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      </div>

      {/* Quick Links — horizontal scroll with arrows */}
      <div className="mb-12 relative w-[160vh] sm:w-[120vh] md:w-[160vh] lg:w-[160vh] xl:w-[140vh] 2xl:w-[90vh]">
        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 overflow-x-hidden no-scrollbar py-2 px-6 sm:px-8 snap-x snap-mandatory"
          style={{ scrollBehavior: 'smooth', touchAction: 'pan-y' }}
        >
          {filteredGuides.length > 0 ? (
            filteredGuides.map((guide, index) => {
              const isActive = index === activeIndex;
              return (
                <div
                  key={index}
                  onClick={() => setSelectedGuide(guide)}
                  className={`w-56 sm:w-60 md:w-72 flex-none bg-white rounded-lg shadow-md p-3 md:p-4 hover:shadow-lg transition cursor-pointer snap-start ${
                    isActive ? 'scale-[1.02] ring-2 ring-blue-100' : ''
                  }`}
                >
                  <div className="mb-2 md:mb-3 flex items-center justify-between">
                    <div>{guide.icon}</div>
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-1 md:mb-2">{guide.title}</h3>
                  <p className="text-gray-600 text-sm">{guide.description}</p>
                </div>
              );
            })
          ) : (
            <div className="w-full text-center py-8 text-gray-500">No guides found matching your search</div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-2 right-2 flex items-center justify-between z-10">
          <button
            onClick={() => scroll('left')}
            className="pointer-events-auto bg-white/90 border border-gray-200 rounded-full p-2 shadow-md"
            aria-label="Scroll left"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={() => scroll('right')}
            className="pointer-events-auto bg-white/90 border border-gray-200 rounded-full p-2 shadow-md"
            aria-label="Scroll right"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {filteredGuides.length === 0 && filteredFaqs.length === 0 && searchQuery && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-800">
            No results found for "<strong>{searchQuery}</strong>". Try searching with different keywords.
          </p>
        </div>
      )}

      {/* FAQ Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center mb-6">
          <FaQuestionCircle className="text-blue-600 text-2xl mr-3" />
          <h2 className="text-2xl font-semibold text-gray-800">Frequently Asked Questions</h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {faqCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No FAQs found matching your search.</p>
          ) : (
            filteredFaqs.map((faq, index) => (
              <details
                key={index}
                className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition"
              >
                <summary className="font-semibold text-gray-800 list-none flex items-center">
                  <FaQuestionCircle className="text-blue-600 mr-3" />
                  {faq.question}
                </summary>
                <p className="mt-3 ml-8 text-gray-600">{faq.answer}</p>
              </details>
            ))
          )}
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Contact Support</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start">
            <FaEnvelope className="text-blue-600 text-2xl mr-4 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Email Support</h3>
              <p className="text-gray-600 text-sm mb-2">Send us an email and we'll respond within 24 hours</p>
              <a href="mailto:bangka.elyu@gmail.com" className="text-blue-600 hover:underline">
                bangka.elyu@gmail.com
              </a>
            </div>
          </div>
          <div className="flex items-start">
            <FaPhone className="text-green-600 text-2xl mr-4 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Phone Support</h3>
              <p className="text-gray-600 text-sm mb-2">Available Monday to Friday, 8:00 AM - 5:00 PM</p>
              <a href="tel:+1234567890" className="text-green-600 hover:underline">
                +63 XXX XXX XXXX
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>System Version:</strong> v5.2 | <strong>Last Updated:</strong> October 2025
            </p>
          </div>
        </div>
      </div>

      {/* Guide Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/10 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">{selectedGuide.title}</h2>
              <button
                onClick={() => setSelectedGuide(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <FaTimes className="text-2xl" />
              </button>
            </div>
            <div className="px-6 py-6">{selectedGuide.content}</div>
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default HelpCenter;
