import { useState, useRef, useEffect } from 'react';
import { FaBook, FaQuestionCircle, FaEnvelope, FaPhone, FaSearch, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'
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
      question: 'How do I add a new fisherfolk record?',
      answer: 'Navigate to Fisherfolk Management, click the "Add Fisherfolk" button, and fill in the required information including personal details, contact information, and location data.',
    },
    {
      category: 'fisherfolk',
      question: 'How can I edit fisherfolk information?',
      answer: 'Go to Fisherfolk Management, find the record you want to edit, click on the edit icon, make your changes, and save.',
    },
    {
      category: 'boat',
      question: 'How do I register a new boat?',
      answer: 'Go to Boat Registry Management, click "Add Boat", fill in the boat details including registration number, type, and owner information.',
    },
    {
      category: 'boat',
      question: 'Can I import boat records from Excel?',
      answer: 'Yes! Go to Utility > Imports > Boat Excel Import. Download the template, fill it with your data, and upload the file.',
    },
    {
      category: 'tracking',
      question: 'How does BirukBilug tracking work?',
      answer: 'BirukBilug tracking uses GPS devices attached to boats to monitor their location in real-time. You can view boat locations on the map and track their movement history.',
    },
    {
      category: 'reports',
      question: 'What types of reports can I generate?',
      answer: 'You can generate Fisherfolk Reports, Boat Reports, and Activity Log Reports. All reports can be exported to PDF or Excel format.',
    },
    {
      category: 'users',
      question: 'How do I add a new user?',
      answer: 'Go to User Management, click "Add User", select the user role (Admin, Provincial Agriculturist, or Municipal Agriculturist), and fill in their details.',
    },
    {
      category: 'users',
      question: 'How do I reset a user\'s password?',
      answer: 'In User Management, click on the user, select "Reset Password", and a password reset link will be sent to their email.',
    },
  ];

  const guides = [
    {
      icon: <FaBook className="text-blue-600 text-3xl" />,
      title: 'Installing Dependencies',
      description: 'Set up the development environment and required tools (Node, Python, MySQL).',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Installing Dependencies</h3>
          <p className="text-gray-600">Install Node.js (for frontend), Python 3.10+ (for backend), and ensure MySQL/MariaDB client tools (mysqldump, mysql) are available for backup/restore.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-green-600 text-3xl" />,
      title: 'Login',
      description: 'How to sign in and recover access.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Login</h3>
          <p className="text-gray-600">Use your assigned user account to login. If you forget your password, use the password reset flow or contact an administrator to reset your account.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-purple-600 text-3xl" />,
      title: 'Dashboard',
      description: 'Overview of the main dashboard and navigation.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Dashboard</h3>
          <p className="text-gray-600">The dashboard provides quick stats and links to main features such as Fisherfolk Management, Boat Registry, and Reports.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-indigo-600 text-3xl" />,
      title: 'Fisherfolk Management',
      description: 'Add, edit, and search fisherfolk records.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Fisherfolk Management</h3>
          <p className="text-gray-600">Create and maintain fisherfolk records. Use the search and filters to find records. Import templates are available under Utility → Imports.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-teal-600 text-3xl" />,
      title: 'Boat Registry Management',
      description: 'Register and update boats, and manage owners.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Boat Registry Management</h3>
          <p className="text-gray-600">Register new boats, edit boat details, and manage the association with fisherfolk owners. Use MFBR numbers to search for boats.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-yellow-600 text-3xl" />,
      title: 'BirukBilug Tracking',
      description: 'View and search trackers on the map (MFBR search supported).',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">BirukBilug Tracking</h3>
          <p className="text-gray-600">Monitor real-time tracker locations on the map. Use the MFBR search to locate a specific boat or tracker and view its recent movement history.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-red-600 text-3xl" />,
      title: 'User Management',
      description: 'Create, edit, and assign roles to users.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">User Management</h3>
          <p className="text-gray-600">Manage user accounts, roles (Admin, Provincial/Municipal Agriculturist), and permissions. Use the admin tools to invite or deactivate users.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-pink-600 text-3xl" />,
      title: 'Notifications',
      description: 'Configure and send notifications to users.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Notifications</h3>
          <p className="text-gray-600">Create broadcast or targeted notifications. Notifications can include PDF attachments and use the same header/footer as reports.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-cyan-600 text-3xl" />,
      title: 'Report Generation',
      description: 'Generate PDFs and Excel exports for various reports.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Report Generation</h3>
          <p className="text-gray-600">Generate Fisherfolk, Boat, and Activity Log reports. Use filters to customize output and export to PDF or Excel.</p>
        </div>
      ),
    },
    {
      icon: <FaBook className="text-gray-600 text-3xl" />,
      title: 'Utility',
      description: 'Imports, Boundary Editor, Backup & Restore, and other utilities.',
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Utility Tools</h3>
          <ul className="list-disc ml-6 text-gray-600 space-y-2">
            <li><strong>Imports:</strong> Bulk import Fisherfolk or Boat records using the provided Excel templates (Utility → Imports).</li>
            <li><strong>Boundary Editor:</strong> Edit municipal or barangay boundaries used for mapping and filtering.</li>
            <li><strong>Backup & Restore:</strong> Create full SQL backups and restore from .sql files. Do not upload debug JSON files as .sql.</li>
            <li><strong>Help Center:</strong> This page — use the topics above for step-by-step guides.</li>
          </ul>
        </div>
      ),
    },
  ];




  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const scroll = (dir) => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  // Update active index based on which card is closest to container center
  const updateActiveIndex = () => {
    const el = scrollRef.current
    if (!el) return
    const children = Array.from(el.children)
    if (!children.length) return
    const containerRect = el.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2
    let best = 0
    let bestDist = Infinity
    children.forEach((child, i) => {
      const r = child.getBoundingClientRect()
      const childCenter = r.left + r.width / 2
      const dist = Math.abs(childCenter - containerCenter)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setActiveIndex(best)
  }

  // Attach scroll/resize listeners and block manual horizontal panning
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // update on scroll
    const onScroll = () => updateActiveIndex()
    el.addEventListener('scroll', onScroll, { passive: true })

    // prevent manual horizontal scrolling (wheel, touch)
    const onWheel = (e) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    let sx = 0, sy = 0
    const onTouchStart = (e) => {
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY
    }
    const onTouchMove = (e) => {
      const t = e.touches[0]
      const dx = Math.abs(t.clientX - sx)
      const dy = Math.abs(t.clientY - sy)
      if (dx > dy) e.preventDefault()
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })

    // update on resize
    window.addEventListener('resize', updateActiveIndex)
    // initial
    updateActiveIndex()
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('resize', updateActiveIndex)
    }
  }, [scrollRef.current])

  const slugify = (text) =>
    text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/&/g, '-and-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')

  // Map specific guide titles to the actual route names used in AppRoutes.jsx
  const TITLE_TO_ROUTE = {
    'Installing Dependencies': 'installing-dependencies',
    'Login': 'login',
    'Dashboard': 'dashboard',
    'Fisherfolk Management': 'fisherfolk',
    'Boat Registry Management': 'boat-registry',
    'BirukBilug Tracking': 'birukbilug',
    'User Management': 'user-management',
    'Notifications': 'notifications',
    'Report Generation': 'reports',
    'Utility': 'utility',
  }


  // filter guides by search query
  const q = searchQuery.trim().toLowerCase()
  const filteredGuides = guides.filter((guide) => {
    return (
      q === '' ||
      guide.title.toLowerCase().includes(q) ||
      guide.description.toLowerCase().includes(q)
    )
  })

  // filter faqs by category and search query
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory
    const matchesQuery =
      q === '' ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q)
    return matchesCategory && matchesQuery
  })

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
          <div className="mb-12 relative w-[160vh] sm:w-[120vh] md:w-[160vh] lg:w-[160vh] xl:w-[140vh] 2xl:w-[90vh]">        <div
            ref={scrollRef}
            className="flex gap-2 sm:gap-3 overflow-x-hidden no-scrollbar py-2 px-6 sm:px-8 snap-x snap-mandatory"
            style={{ scrollBehavior: 'smooth', touchAction: 'pan-y' }}
          >
            {filteredGuides.length > 0 ? (
              filteredGuides.map((guide, index) => {
                const isActive = index === activeIndex
                return (
                  <div
                    key={index}
                    onClick={() => {
                      const route = TITLE_TO_ROUTE[guide.title] || slugify(guide.title)
                      navigate(`/admin/help/${route}`)
                    }}
                    className={`w-56 sm:w-60 md:w-72 flex-none bg-white rounded-lg shadow-md p-3 md:p-4 hover:shadow-lg transition cursor-pointer snap-start ${isActive ? 'scale-[1.02] ring-2 ring-blue-100' : ''}`}
                  >
                    <div className="mb-2 md:mb-3 flex items-center justify-between">
                      <div>{guide.icon}</div>
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-1 md:mb-2">{guide.title}</h3>
                    <p className="text-gray-600 text-sm">{guide.description}</p>
                  </div>
                )
              })
            ) : (
              <div className="w-full text-center py-8 text-gray-500">
                No guides found matching your search
              </div>
            )}
          </div>
            {/* Arrow overlay inside bounds */}
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

          {/* Show message if no results found */}
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

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {faqCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* FAQ List */}
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
                  <p className="text-gray-600 text-sm mb-2">
                    Send us an email and we'll respond within 24 hours
                  </p>
                  <a href="mailto:bangka.elyu@gmail.com" className="text-blue-600 hover:underline">
                    bangka.elyu@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start">
                <FaPhone className="text-green-600 text-2xl mr-4 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Phone Support</h3>
                  <p className="text-gray-600 text-sm mb-2">
                    Available Monday to Friday, 8:00 AM - 5:00 PM
                  </p>
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
                <div className="px-6 py-6">
                  {selectedGuide.content}
                </div>
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