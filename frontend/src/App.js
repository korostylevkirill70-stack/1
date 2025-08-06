import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TGStatParser = () => {
  // Form state
  const [selectedCategory, setSelectedCategory] = useState("crypto");
  const [selectedContentTypes, setSelectedContentTypes] = useState(["channels"]);
  const [maxPages, setMaxPages] = useState(3);
  
  // Parsing state
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [parsingStatus, setParsingStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Categories for TGStat
  const categories = [
    "crypto", "tech", "news", "business", "entertainment", 
    "education", "science", "sports", "travel", "lifestyle"
  ];
  
  // Content types
  const contentTypes = [
    { value: "channels", label: "Каналы" },
    { value: "chats", label: "Чаты" }
  ];

  // Handle content type selection
  const handleContentTypeChange = (type) => {
    setSelectedContentTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Start parsing
  const startParsing = async () => {
    if (selectedContentTypes.length === 0) {
      setError("Выберите хотя бы один тип контента");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setParsingStatus(null);

    try {
      const response = await axios.post(`${API}/start-parsing`, {
        category: selectedCategory,
        content_types: selectedContentTypes,
        max_pages: maxPages
      });

      setCurrentTaskId(response.data.task_id);
      
      // Start polling for status
      pollParsingStatus(response.data.task_id);
      
    } catch (err) {
      setError(err.response?.data?.detail || "Ошибка при запуске парсинга");
      setIsLoading(false);
    }
  };

  // Poll parsing status
  const pollParsingStatus = async (taskId) => {
    const poll = async () => {
      try {
        const statusResponse = await axios.get(`${API}/parsing-status/${taskId}`);
        const status = statusResponse.data;
        
        setParsingStatus(status);
        
        if (status.status === "completed") {
          // Get results
          const resultsResponse = await axios.get(`${API}/parsing-results/${taskId}`);
          setResults(resultsResponse.data.results);
          setIsLoading(false);
          return;
        } else if (status.status === "failed") {
          setError(status.error_message || "Парсинг завершился с ошибкой");
          setIsLoading(false);
          return;
        }
        
        // Continue polling if still running
        if (status.status === "running" || status.status === "pending") {
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
        
      } catch (err) {
        console.error("Error polling status:", err);
        setTimeout(poll, 5000); // Retry after 5 seconds
      }
    };
    
    poll();
  };

  // Export results
  const exportResults = async () => {
    if (!currentTaskId) return;
    
    try {
      const response = await axios.get(`${API}/export-results/${currentTaskId}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tgstat_results_${selectedCategory}_${new Date().getTime()}.txt`;
      link.click();
      
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Ошибка при экспорте результатов");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              🚀 TGStat Parser
            </h1>
            <p className="text-gray-600">
              Парсинг каналов и чатов с TGStat.ru с возможностью выбора количества страниц
            </p>
          </div>

          {/* Parsing Form */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Left Column - Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">⚙️ Настройки парсинга</h2>
              
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📂 Категория:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Типы контента:
                </label>
                <div className="space-y-2">
                  {contentTypes.map(type => (
                    <label key={type.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedContentTypes.includes(type.value)}
                        onChange={() => handleContentTypeChange(type.value)}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={isLoading}
                      />
                      <span className="text-gray-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Max Pages */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📄 Количество страниц для парсинга:
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Ограничение: от 1 до 50 страниц
                </p>
              </div>

              {/* Start Button */}
              <button
                onClick={startParsing}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "🔄 Парсинг в процессе..." : "🚀 Начать парсинг"}
              </button>
            </div>

            {/* Right Column - Status */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Статус и результаты</h2>
              
              {/* Status Display */}
              {parsingStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-blue-800">
                      Статус: {parsingStatus.status === "running" ? "Выполняется" : 
                               parsingStatus.status === "completed" ? "Завершено" : 
                               parsingStatus.status === "failed" ? "Ошибка" : "Ожидание"}
                    </span>
                    <span className="text-sm text-blue-600">
                      ID: {currentTaskId?.slice(-8)}
                    </span>
                  </div>
                  
                  {parsingStatus.total_pages > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-blue-600 mb-1">
                        <span>Прогресс</span>
                        <span>{parsingStatus.progress} результатов</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{
                            width: `${parsingStatus.total_pages > 0 ? 
                              (parsingStatus.progress / (parsingStatus.total_pages * 8)) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {parsingStatus.error_message && (
                    <p className="text-red-600 text-sm mt-2">
                      ❌ {parsingStatus.error_message}
                    </p>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">❌ {error}</p>
                </div>
              )}

              {/* Results Summary */}
              {results.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-green-800">
                        ✅ Парсинг завершен!
                      </p>
                      <p className="text-sm text-green-600">
                        Найдено {results.length} каналов/чатов
                      </p>
                    </div>
                    <button
                      onClick={exportResults}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                    >
                      📥 Экспорт
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Table */}
          {results.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📋 Результаты парсинга ({results.length} элементов)
              </h2>
              
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Название
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ссылка
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Подписчики
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Тип
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                            {result.name}
                          </div>
                          {result.description && (
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {result.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {result.link !== "N/A" ? (
                            <a 
                              href={result.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm break-all"
                            >
                              {result.link.length > 30 ? 
                                result.link.substring(0, 30) + "..." : 
                                result.link}
                            </a>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {result.subscribers}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {result.content_type === "channels" ? "Канал" : "Чат"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Export format info */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Формат экспорта:</strong> "1. название \ ссылка \ количество подписчиков"
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  При экспорте данные будут сохранены в указанном формате для удобного использования.
                </p>
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-gray-500 text-sm">
              🤖 TGStat Parser - Автоматический парсинг Telegram каналов и чатов
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <TGStatParser />
    </div>
  );
}

export default App;