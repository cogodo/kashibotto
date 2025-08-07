import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchSongs, getLyrics, processLyrics } from './utils/api';
import './index.css';

interface Segment {
  text: string;
  reading: string;
  translation: string;
  dictionary?: string[];
}

interface ProcessedLyrics {
  lines: Segment[][];
}

interface SearchSuggestion {
  id: number;
  title: string;
  artist: string;
  full_title: string;
}

interface TooltipProps {
  segment: Segment;
  children: React.ReactNode;
}

// Function to check if text contains Japanese characters
const containsJapaneseText = (text: string): boolean => {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text);
};

// Function to check if text is a section header (Verse, Chorus, etc.)
const isSectionHeader = (text: string): boolean => {
  const sectionRegex = /^(Verse|Chorus|Refrain|Bridge|Intro|Outro|Pre-chorus|Post-chorus|Interlude)(\s*\d*)?$/i;
  return sectionRegex.test(text.trim());
};

const Tooltip: React.FC<TooltipProps> = ({ segment, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <span
        className="cursor-pointer transition-all duration-200 hover:scale-105 hover:rotate-1"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        {children}
      </span>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 z-50"
          >
            <div className="tooltip-glass min-w-[280px]">
              <div className="space-y-3">
                <div className="font-display text-primary-400 text-lg font-bold">
                  {segment.reading}
                </div>
                <div className="text-white text-base font-medium">
                  {segment.translation}
                </div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600/50"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LoadingSpinner: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
  >
    <div className="relative">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-4 border-gray-300 dark:border-gray-600 border-t-primary-500 rounded-full"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-accent-pink-500 rounded-full"
      />
    </div>

    <div className="text-center space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-display text-gray-900 dark:text-white font-bold"
      >
        Processing Lyrics...
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-gray-600 dark:text-gray-400 text-lg"
      >
        Analyzing Japanese text with MeCab
      </motion.div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 2, repeat: Infinity }}
        className="h-1 bg-gradient-to-r from-primary-500 via-accent-pink-500 to-accent-purple-500 rounded-full mx-auto max-w-xs"
      />
    </div>
  </motion.div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass-card-static border-red-500/50 p-6 text-red-600 dark:text-red-400"
  >
    <div className="flex items-center space-x-3">
      <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <span className="font-semibold text-lg">{message}</span>
    </div>
  </motion.div>
);

const DarkModeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const isDarkMode = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleDarkMode}
      className="p-3 rounded-2xl glass-card hover:shadow-glow transition-all duration-300"
    >
      {isDark ? (
        <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-6 h-6 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </motion.button>
  );
};

const App: React.FC = () => {
  const [title, setTitle] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<string>('');

  const [processedLyrics, setProcessedLyrics] = useState<ProcessedLyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live search state
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  const handleTitleChange = (value: string) => {
    setTitle(value);
    setSelectedArtist(''); // Clear selected artist when user types

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim() || value.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await searchSongs(value);
        setSearchSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    // Use the title field directly (it's already clean)
    setTitle(suggestion.title);
    setSelectedArtist(suggestion.artist || '');
    setShowSuggestions(false);
    setSearchSuggestions([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProcess = async () => {
    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    setLoading(true);
    setError(null);
    setProcessedLyrics(null);

    try {
      const lyricsData = await getLyrics(title, selectedArtist);
      const lyrics = lyricsData.lyrics;

      const processedData = await processLyrics(lyrics);
      setProcessedLyrics(processedData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProcess();
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient dark:bg-hero-gradient-dark relative overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(0, 191, 174, 0.3), rgba(0, 229, 255, 0.2))' }}
        />
        <motion.div
          animate={{
            x: [0, -150, 0],
            y: [0, 100, 0],
            scale: [1, 0.8, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-3/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(63, 81, 181, 0.3), rgba(0, 229, 255, 0.2))' }}
        />
        <motion.div
          animate={{
            x: [0, 200, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-1/4 left-3/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(233, 30, 99, 0.3), rgba(0, 191, 174, 0.2))' }}
        />
      </div>

      {/* Header with dark mode toggle */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex justify-between items-center p-6"
      >
        <div></div>
        <DarkModeToggle />
      </motion.div>

      <div className="relative z-10 container mx-auto px-6 py-8 max-w-6xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-2xl md:text-3xl font-display font-medium mb-3 gradient-text opacity-80"
          >
            歌詞ボット
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-7xl md:text-8xl font-display font-bold mb-6 gradient-text text-shadow-lg"
          >
            Kashibotto
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-2xl md:text-3xl text-gray-700 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed font-body"
          >
            Japanese lyrics analysis with morphological segmentation and translation
          </motion.p>
        </motion.div>

        {/* Main Input Interface */}
        {!processedLyrics && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex items-center justify-center min-h-[40vh]"
          >
            <div className="w-full max-w-2xl mx-auto">
              <div className="glass-card p-8">
                <div className="space-y-6">
                  <div className="relative">
                    <label htmlFor="title" className="block text-xl font-display font-bold text-gray-900 dark:text-white mb-3">
                      Song Title
                    </label>
                    <input
                      ref={searchInputRef}
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="e.g., 夜に駆ける, 前前前世, 残酷な天使のテーゼ"
                      className="input-glass text-lg"
                    />

                    {/* Search suggestions */}
                    <AnimatePresence>
                      {showSuggestions && searchSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 dropdown-solid z-50 max-h-60 overflow-y-auto"
                        >
                          {searchSuggestions.map((suggestion) => (
                            <motion.button
                              key={suggestion.id}
                              whileHover={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                              onClick={() => handleSelectSuggestion(suggestion)}
                              className="w-full px-4 py-4 text-left transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl border-b border-gray-300/20 dark:border-gray-700/20 last:border-b-0"
                            >
                              <div className="font-bold text-lg text-gray-900 dark:text-white">{suggestion.title}</div>
                              <div className="text-gray-600 dark:text-gray-400 text-base">by {suggestion.artist}</div>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>



                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleProcess}
                    disabled={loading}
                    className="w-full btn-primary text-xl font-display disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : 'Analyze Lyrics'}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && <LoadingSpinner />}

        {/* Error State */}
        {error && <ErrorMessage message={error} />}

        {/* Processed Lyrics */}
        {processedLyrics && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="glass-card p-8"
          >
            {/* Back Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-8"
            >
              <button
                onClick={() => {
                  setProcessedLyrics(null);
                  setTitle('');
                  setSelectedArtist('');
                  setError(null);
                }}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Search</span>
              </button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-10"
            >
              <h2 className="text-5xl font-display font-bold mb-4 gradient-text">
                {title}
              </h2>
              {selectedArtist && (
                <p className="text-2xl text-gray-600 dark:text-gray-400 font-body mb-4">
                  by {selectedArtist}
                </p>
              )}
              <p className="text-xl text-gray-700 dark:text-gray-300 font-body">
                Hover or click on Japanese text to see readings, translations, and definitions
              </p>
            </motion.div>

            <div className="space-y-4">
              {processedLyrics.lines.map((line, lineIndex) => (
                <motion.div
                  key={lineIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: lineIndex * 0.1 }}
                  className={line.length === 0 ? "h-6" : "leading-relaxed text-3xl md:text-4xl lg:text-5xl text-center font-body"}
                >
                  {line.length === 0 ? (
                    // Empty line for spacing between verses
                    <div className="h-6"></div>
                  ) : (
                    // Check if this line is a section header
                    line.length === 1 && isSectionHeader(line[0].text) ? (
                      <div className="section-header">
                        {line[0].text}
                      </div>
                    ) : (
                      line.map((segment, segmentIndex) => {
                        if (containsJapaneseText(segment.text)) {
                          return (
                            <Tooltip key={segmentIndex} segment={segment}>
                              <span className="text-gray-900 dark:text-white font-bold hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-300 gradient-text-hover">
                                {segment.text}
                              </span>
                            </Tooltip>
                          );
                        } else {
                          return (
                            <span key={segmentIndex} className="text-gray-600 dark:text-gray-400 font-medium">
                              {segment.text}
                            </span>
                          );
                        }
                      })
                    )
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Spacer to prevent dropdown overlap */}
        {!processedLyrics && !loading && !error && (
          <div className="h-20"></div>
        )}

        {/* Instructions */}
        {!processedLyrics && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="max-w-3xl mx-auto glass-card p-8 mt-16"
          >
            <h3 className="text-3xl font-display font-bold gradient-text mb-6 text-center">
              How to use:
            </h3>
            <ul className="text-gray-700 dark:text-gray-300 space-y-4 text-xl font-body">
              <motion.li
                whileHover={{ x: 10 }}
                className="flex items-center space-x-4"
              >
                <div className="w-3 h-3 rounded-full shadow-glow-emerald" style={{ backgroundColor: '#00BFAE' }}></div>
                <span>Enter a song title (try "夜に駆ける" or "前前前世")</span>
              </motion.li>
              <motion.li
                whileHover={{ x: 10 }}
                className="flex items-center space-x-4"
              >
                <div className="w-3 h-3 rounded-full shadow-glow" style={{ backgroundColor: '#00E5FF' }}></div>
                <span>Optionally add the artist name</span>
              </motion.li>
              <motion.li
                whileHover={{ x: 10 }}
                className="flex items-center space-x-4"
              >
                <div className="w-3 h-3 rounded-full shadow-glow-indigo" style={{ backgroundColor: '#3F51B5' }}></div>
                <span>Click "Analyze Lyrics" to process the text</span>
              </motion.li>
              <motion.li
                whileHover={{ x: 10 }}
                className="flex items-center space-x-4"
              >
                <div className="w-3 h-3 rounded-full shadow-glow-rose" style={{ backgroundColor: '#E91E63' }}></div>
                <span>Hover or click on Japanese text to see translations</span>
              </motion.li>
            </ul>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-16 text-gray-600 dark:text-gray-400 text-lg"
        >
          <p className="gradient-text font-display font-bold">
            Powered by MeCab, Genius Lyrics, and Jisho Dictionary
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default App;