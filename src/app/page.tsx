'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { 
  Input, 
  Button, 
  Code
} from '@heroui/react';
import { 
  Search,
  Copy, 
  Check,
  Github,
  Youtube,
  MapPin,
  Brain,
  Globe,
  X,
  Image,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { SparklesCore } from '@/components/ui/sparkles';
import SplitText from '@/components/ui/split-text';
import { SearchBar } from '@/components/ui/search-bar';
import { BANGS } from '@/lib/bangs';

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  return (
    <Button
      isIconOnly
      variant="flat"
      color={copied ? "success" : "primary"}
      onPress={handleCopy}
      size="sm"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  bang: string;
}

const GridItem = ({ area, icon, title, description, bang }: GridItemProps) => {
  return (
    <li className={`list-none min-h-[14rem] ${area}`}>
      <div className="relative p-2 h-full rounded-2xl border border-gray-800 md:rounded-3xl md:p-3">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
        />
        <div className="flex overflow-hidden relative flex-col gap-6 justify-between p-6 h-full rounded-xl border border-gray-700 backdrop-blur-sm bg-gray-900/50">
          <div className="flex relative flex-col flex-1 gap-3 justify-between">
            <div className="space-y-2">
            <div className="p-2 bg-gray-800 rounded-lg border border-gray-600 w-fit">
              {icon}
              </div>
              <Code className="px-2 py-1 mt-2 text-sm font-semibold text-gray-200 bg-gray-700 rounded-lg w-fit">
                !{bang}
              </Code>
            </div>
            <div className="space-y-3">
                <h3 className="font-sans text-lg font-semibold text-white">
                  {title}
                </h3>
              <p className="font-sans text-sm text-gray-400">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

const noopSubscribe = () => () => {};

function HomePage() {
  const currentUrl = useSyncExternalStore(
    noopSubscribe,
    () => `${window.location.origin}/search?q=%s`,
    () => ''
  );
  const locale = useSyncExternalStore(
    noopSubscribe,
    () => (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' as const : 'en' as const,
    () => 'fr' as const
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const t = {
    tagline: locale === 'fr'
      ? 'Recherche rapide avec des raccourcis ! Ajoutez cette URL comme moteur de recherche personnalisé dans votre navigateur.'
      : 'Quick search with shortcuts! Add this URL as a custom search engine in your browser.',
    configTitle: locale === 'fr' ? 'Configuration du navigateur' : 'Browser setup',
    addSearchEngine: locale === 'fr' ? 'Ajouter comme moteur de recherche' : 'Add as search engine',
    showInstructions: locale === 'fr' ? 'Voir les instructions' : 'Show instructions',
    hideInstructions: locale === 'fr' ? 'Masquer les instructions' : 'Hide instructions',
    bangsTitle: locale === 'fr' ? 'Bangs disponibles' : 'Available bangs',
    examplesTitle: locale === 'fr' ? "Exemples d'utilisation" : 'Usage examples',
  } as const;

  const descEn: Record<string, string> = {
    g: 'Universal search on Google',
    y: 'Video search on YouTube',
    w: 'Wikipedia articles',
    gh: 'Code and projects on GitHub',
    ghr: 'Direct access to GitHub repos',
    m: 'Location and navigation',
    d: 'Private and secure search',
    x: 'Social media search',
    r: 'Discussions and communities',
    c: "OpenAI's AI assistant",
    i: 'Image search',
  };

  const getDesc = (bang: typeof BANGS[number]) => (locale === 'fr' ? bang.description : descEn[bang.trigger]);

  const examples = locale === 'fr'
    ? [
        { code: '(Default) recherche google', desc: 'Recherche Google' },
        { code: '!y musique', desc: 'Recherche YouTube' },
        { code: '!gh', desc: 'Va sur GitHub.com' },
        { code: '!ghr user/repo', desc: 'Va sur un repo GitHub spécifique' },
        { code: '!m restaurant paris', desc: 'Recherche Google Maps' },
      ]
    : [
        { code: '(Default) google search', desc: 'Google Search' },
        { code: '!y music', desc: 'YouTube Search' },
        { code: '!gh', desc: 'Go to GitHub.com' },
        { code: '!ghr user/repo', desc: 'Go to a specific GitHub repo' },
        { code: '!m restaurant paris', desc: 'Google Maps search' },
  ];

  const instructions = locale === 'fr' ? {
    chrome: {
      title: 'Google Chrome / Edge',
      steps: [
        'Allez dans Paramètres → Moteur de recherche → Gérer les moteurs de recherche',
        'Cliquez sur "Ajouter" à côté de "Moteurs de recherche du site"',
        'Nom : "Bangs!"',
        'Raccourci : "bangs" ou "b"',
        `URL : ${currentUrl}`,
        'Cliquez sur "Ajouter" puis définissez comme moteur par défaut si souhaité'
      ]
    },
    firefox: {
      title: 'Firefox',
      steps: [
        'Allez dans Paramètres → Recherche',
        'Faites défiler vers "Raccourcis de recherche"',
        'Cliquez sur "Ajouter un moteur de recherche"',
        'Nom : "Bangs!"',
        `URL : ${currentUrl}`,
        'Définissez un mot-clé comme "bangs" ou "b"'
      ]
    },
    safari: {
      title: 'Safari',
      steps: [
        'Safari ne permet pas d\'ajouter facilement des moteurs personnalisés',
        'Alternative : créez un signet avec ce script JavaScript :',
        `javascript:location.href='${currentUrl.replace('%s', '')}'+encodeURIComponent(prompt('Recherche Bangs:'));`,
        'Utilisez ce signet pour rechercher rapidement'
      ]
    }
  } : {
    chrome: {
      title: 'Google Chrome / Edge',
      steps: [
        'Go to Settings → Search engine → Manage search engines',
        'Click "Add" next to "Site search"',
        'Name: "Bangs!"',
        'Shortcut: "bangs" or "b"',
        `URL: ${currentUrl}`,
        'Click "Add" then set as default if desired'
      ]
    },
    firefox: {
      title: 'Firefox',
      steps: [
        'Go to Settings → Search',
        'Scroll to "Search Shortcuts"',
        'Click "Add search engine"',
        'Name: "Bangs!"',
        `URL: ${currentUrl}`,
        'Set a keyword like "bangs" or "b"'
      ]
    },
    safari: {
      title: 'Safari',
      steps: [
        'Safari doesn\'t easily allow custom search engines',
        'Alternative: create a bookmark with this JavaScript:',
        `javascript:location.href='${currentUrl.replace('%s', '')}'+encodeURIComponent(prompt('Bangs Search:'));`,
        'Use this bookmark for quick searches'
      ]
    }
  };

  return (
    <div className="p-4 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="py-8 mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex relative gap-3 justify-center items-center mt-6 mb-4">
            {/* Sparkles effect behind the title */}
            <div className="absolute inset-0 w-full h-20">
              <SparklesCore
                id="tsparticles"
                background="transparent"
                minSize={0.6}
                maxSize={1.4}
                particleDensity={100}
                className="w-full h-full"
                particleColor="#FACC15"
                speed={2}
              />
            </div>
                         <svg className="relative z-10 w-12 h-12" viewBox="0 0 130 248" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Bang icon">
               <defs>
                 <linearGradient id="bangGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                   <stop offset="0%" stopColor="#FACC15" />
                   <stop offset="100%" stopColor="#F97316" />
                 </linearGradient>
               </defs>
               <path d="M63 180.5L104.5 139L32.5 97.4308C60.6178 69.313 104.5 25.4308 104.5 25.4308" stroke="url(#bangGradient)" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round"/>
               <circle cx="25" cy="223" r="25" fill="url(#bangGradient)"/>
             </svg>
            <SplitText
              text="Bangs!"
              className="text-5xl font-bold text-white"
              delay={100}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 40 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="-100px"
              textAlign="center"
            />
          </div>
          <p className="mx-auto max-w-2xl text-xl text-gray-400">
            {t.tagline}
          </p>
        </div>

        {/* Live Search Bar */}
        <div className="mx-auto mb-10 max-w-2xl">
          <SearchBar locale={locale} />
        </div>

        {/* URL Configuration */}
        <div className="mx-auto mb-12 max-w-2xl">
          <h2 className="mb-4 text-xl font-semibold text-center text-white">{t.configTitle}</h2>
          <div className="relative p-2 rounded-2xl border border-gray-800 md:rounded-3xl md:p-3">
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="flex relative gap-3 items-center p-6 w-full rounded-xl border border-gray-700 backdrop-blur-sm bg-gray-900/50">
              <Globe className="flex-shrink-0 w-5 h-5 text-gray-400" />
              <Input
                value={currentUrl}
                readOnly
                variant="flat"
                classNames={{
                  input: "font-medium text-sm mt-3.5 mb-1 text-white",
                  inputWrapper: "bg-gray-800 border-gray-700 rounded-lg h-12"
                }}
                className="flex-1"
              />
              <CopyButton url={currentUrl} />
            </div>
          </div>
          
          {/* Add Search Engine Button */}
          <div className="mt-6 w-full text-center">
            <div className="inline-block relative p-2 rounded-2xl border border-gray-800 shadow-2xl">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
              />
              <Button
                variant="flat"
                color="primary"
                startContent={<div className="w-4 h-4" />}
                endContent={<div className="flex justify-center">{showInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>}
                onPress={() => setShowInstructions(!showInstructions)}
                className="relative px-3 py-3 font-semibold text-black bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg border-2 shadow-lg transition-all duration-200 transform hover:shadow-2xl hover:scale-100 hover:-translate-y-1 active:scale-95 active:translate-y-0 border-yellow-400/30"
              >
                {t.addSearchEngine}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          {showInstructions && (
            <div className="relative p-2 mt-6 rounded-2xl border border-gray-800 md:rounded-3xl md:p-3">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
              />
              <div className="relative p-6 rounded-xl border border-gray-700 backdrop-blur-sm bg-gray-900/50">
                <div className="space-y-6">
                  {Object.entries(instructions).map(([browser, config]) => (
                    <div key={browser} className="space-y-3">
                      <h3 className="flex gap-2 items-center text-lg font-semibold text-white">
                        {config.title}
                      </h3>
                      <ol className="space-y-2 text-sm list-decimal list-inside text-gray-300">
                        {config.steps.map((step, index) => (
                          <li key={index} className="leading-relaxed">
                            {step.startsWith('javascript:') ? (
                              <Code className="block p-2 mt-1 text-xs break-all bg-gray-800 rounded">
                                {step}
                              </Code>
                            ) : step.includes(currentUrl) ? (
                              <>
                                {step.split(currentUrl)[0]}
                                <Code className="px-1 py-0.5 text-xs bg-gray-800 rounded">
                                  {currentUrl}
                                </Code>
                                {step.split(currentUrl)[1]}
                              </>
                            ) : (
                              step
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bangs Grid avec effet de lueur */}
        <div className="mx-auto mb-12 max-w-2xl">
          <h2 className="mb-8 text-3xl font-semibold text-center text-white">{t.bangsTitle}</h2>
          <ul className="grid grid-cols-2 grid-rows-none gap-6 md:grid-cols-12 md:grid-rows-4lg:gap-6">
            <GridItem
              area="md:[grid-area:1/1/2/7]"
              icon={<Image className="w-5 h-5 text-blue-500" />}
              title={BANGS[10].name}
              description={getDesc(BANGS[10])}
              bang={BANGS[10].trigger}
            />
            <GridItem
              area="md:[grid-area:1/7/2/13]"
              icon={<Youtube className="w-5 h-5 text-red-500" />}
              title={BANGS[1].name}
              description={getDesc(BANGS[1])}
              bang={BANGS[1].trigger}
            />
            <GridItem
              area="md:[grid-area:2/1/3/5]"
              icon={<Globe className="w-5 h-5 text-yellow-500" />}
              title={BANGS[2].name}
              description={getDesc(BANGS[2])}
              bang={BANGS[2].trigger}
            />
            <GridItem
              area="md:[grid-area:2/5/3/9]"
              icon={<Github className="w-5 h-5 text-white" />}
              title={BANGS[3].name}
              description={getDesc(BANGS[3])}
              bang={BANGS[3].trigger}
            />
            <GridItem
              area="md:[grid-area:2/9/3/13]"
              icon={<X className="w-5 h-5 text-white" />}
              title={BANGS[7].name}
              description={getDesc(BANGS[7])}
              bang={BANGS[7].trigger}
            />
            <GridItem
              area="md:[grid-area:3/1/4/7]"
              icon={<MapPin className="w-5 h-5 text-green-500" />}
              title={BANGS[5].name}
              description={getDesc(BANGS[5])}
              bang={BANGS[5].trigger}
            />
            <GridItem
              area="md:[grid-area:3/7/4/13]"
              icon={<Brain className="w-5 h-5 text-purple-500" />}
              title={BANGS[9].name}
              description={getDesc(BANGS[9])}
              bang={BANGS[9].trigger}
            />
            <GridItem
              area="md:[grid-area:4/1/5/13]"
              icon={<Search className="w-5 h-5 text-orange-500" />}
              title={BANGS[6].name}
              description={getDesc(BANGS[6])}
              bang={BANGS[6].trigger}
            />
          </ul>
        </div>

        {/* Examples */}
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-2xl font-semibold text-center text-white">{t.examplesTitle}</h2>
          <div className="relative p-2 rounded-2xl border border-gray-800 md:rounded-3xl md:p-3">
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative p-6 rounded-xl border border-gray-700 backdrop-blur-sm bg-gray-900/50">
              <div className="space-y-4">
                {examples.map((example, index) => (
                  <div key={index} className="flex justify-between items-center p-4 rounded-lg border border-gray-600 bg-gray-800/50">
                    <Code className="px-3 py-1 text-sm text-gray-200 bg-gray-700 rounded-lg">
                      {example.code}
                    </Code>
                    <span className="ml-4 text-gray-400">→ {example.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="flex gap-2 justify-center items-center mt-10 mb-10 text-sm text-center text-gray-400">
        <a
          href="https://github.com/gayakaci20/bangs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-2 items-center text-gray-400 hover:text-gray-300"
        >
          <Github className="w-4 h-4" aria-hidden="true" />
          <span>Open Source Project by Gaya KACI</span>
        </a>
      </footer>
    </div>
  );
}

export default HomePage;
