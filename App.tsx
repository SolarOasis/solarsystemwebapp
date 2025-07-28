
import React, { useState, useContext, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ComponentsPage from './pages/ComponentsPage';
import ProjectsPage from './pages/ProjectsPage';
import SuppliersPage from './pages/SuppliersPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import CalculatorPage from './pages/CalculatorPage';
import AiAssistantPage from './pages/AiAssistantPage'; // Import the new page
import { AppContext } from './context/AppContext';
import { Sun, Wrench, Package, Users, BarChart3, Menu, X, Loader, Settings, Calculator, Sparkles } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/components', label: 'Components', icon: Package },
  { path: '/projects', label: 'Projects', icon: Wrench },
  { path: '/calculator', label: 'Calculator', icon: Calculator },
  { path: '/ai-assistant', label: 'AI Assistant', icon: Sparkles },
  { path: '/suppliers', label: 'Suppliers', icon: Users },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('isAuthenticated') === 'true');
  const { state, loadInitialData } = useContext(AppContext);
  const { loading, error } = state;

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  
  const handleLoginSuccess = () => {
    sessionStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }


  return (
    <HashRouter>
      <div className="flex h-screen bg-gray-100 font-sans">
        {loading && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="flex flex-col items-center">
                <Loader className="animate-spin text-brand-secondary h-16 w-16" />
                <p className="text-white mt-4 text-lg">Loading Solar Oasis Data...</p>
             </div>
           </div>
        )}
        <MainLayout error={error}/>
      </div>
    </HashRouter>
  );
};

const MainLayout = ({ error }: { error: string | null }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    
    const pageTitle = navItems.find(item => {
        if (item.path === '/projects' && location.pathname.startsWith('/projects')) return true;
        return item.path === location.pathname
    })?.label || "Solar Oasis";

    return (
        <>
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
                <Header pageTitle={pageTitle} onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
                <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-brand-light">
                    {error && location.pathname !== '/settings' ? (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                        <p className="font-bold">Configuration Error</p>
                        <p>{error} <Link to="/settings" className="font-bold underline">Go to Settings</Link></p>
                      </div>
                    ) : (
                      <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/components" element={<ComponentsPage />} />
                          <Route path="/projects" element={<ProjectsPage />} />
                          <Route path="/projects/:projectId" element={<ProjectsPage />} />
                          <Route path="/calculator" element={<CalculatorPage />} />
                          <Route path="/ai-assistant" element={<AiAssistantPage />} />
                          <Route path="/suppliers" element={<SuppliersPage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    )}
                </main>
            </div>
        </>
    )
}

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const location = useLocation();

  return (
    <>
      <div className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 bg-brand-primary text-white flex-col transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between p-4 border-b border-brand-dark">
            <div className="flex items-center gap-2">
                <Sun className="h-8 w-8 text-brand-secondary" />
                <h1 className="text-xl font-bold">Solar Oasis</h1>
            </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 mt-6">
          <ul>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path === '/projects' && location.pathname.startsWith('/projects'));
              return (
                <li key={item.path} className="px-4 mb-2">
                  <Link
                    to={item.path}
                    onClick={() => setIsSidebarOpen(window.innerWidth > 1024 ? true : false)}
                    className={`flex items-center p-3 rounded-lg transition-colors ${isActive ? 'bg-brand-secondary text-brand-primary font-bold' : 'hover:bg-brand-dark'}`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-brand-dark mt-auto">
            <p className="text-xs text-gray-400">&copy; 2024 Solar Oasis FZCO</p>
            <p className="text-xs text-gray-400">solaroasis.ae</p>
        </div>
      </div>
       {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 lg:hidden"></div>}
    </>
  );
};

interface HeaderProps {
    pageTitle: string;
    onMenuClick: () => void;
    isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, onMenuClick, isSidebarOpen }) => {
  return (
    <header className="bg-white shadow-md p-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center">
        {!isSidebarOpen && (
            <button onClick={onMenuClick} className="text-gray-600 mr-4">
                <Menu size={24} />
            </button>
        )}
        <h2 className="text-2xl font-semibold text-gray-800">{pageTitle}</h2>
      </div>
    </header>
  );
};

export default App;
