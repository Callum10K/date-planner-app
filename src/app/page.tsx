"use client";


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Rabbit, Loader2, ListOrdered, Inbox, PlusCircle, Trash2, Edit, LogIn } from 'lucide-react';

// --- 1. Type Definitions (Mirroring Prisma Schema) ---

// TypeScript models matching the backend structure
interface TripPlace {
  id: string;
  day: number;
  time: string;
  name: string;
  purpose: string;
  notes: string | null;
  latitude: number;
  longitude: number;
}

enum SuggestionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

interface Suggestion {
  id: string;
  userId: string;
  title: string;
  text: string;
  status: SuggestionStatus;
  createdAt: string;
}

// Initial state for the form when creating a new place
const initialTripPlaceFormData: Omit<TripPlace, 'id'> = {
    day: 1, 
    time: '12:00', 
    name: '', 
    purpose: '', 
    notes: '', 
    latitude: 0, 
    longitude: 0
};

// --- 2. Authorization and Fetch Context ---

const USER_ID = typeof window !== 'undefined' ? (localStorage.getItem('user_id') || crypto.randomUUID()) : 'server-user';
if (typeof window !== 'undefined') {
    localStorage.setItem('user_id', USER_ID);
}

const API_BASE_URL = '/api';

// Custom hook to handle API calls, including the unified authorization header
const useApiFetcher = () => {
    // Retrieve the unified secret from localStorage
    const authSecret = typeof window !== 'undefined' ? localStorage.getItem('auth_secret') : null;
    const maxRetries = 3;

    const safeFetch = useCallback(async (
        endpoint: string, 
        options: RequestInit = {}, 
        requiresAuth: boolean = false 
    ) => {
        const headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            // Send unified auth secret if required and available
            ...(requiresAuth && authSecret ? { 'x-auth-secret': authSecret } : {}),
        };

        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
                
                if (response.status === 403 && requiresAuth) {
                    throw new Error('Authorization Failed (403): Please check your Admin/Trusted Secret Key.');
                }
                
                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
                }
                
                return response.json();

            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error; 
                }
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }, [authSecret]);
    
    return safeFetch;
};


// --- 3. Shared Components and Utilities ---

const openMap = (lat: number, lon: number) => {
    if (typeof window !== 'undefined') {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        window.open(mapUrl, '_blank');
    }
};

const getPurposeColor = (purpose: string): string => {
    const p = purpose.toLowerCase();
    if (p.includes('food') || p.includes('dinner')) return 'border-[#e3a1e9] text-[#e3a1e9]'; // Pink
    if (p.includes('sightseeing')) return 'border-[#6a329f] text-[#6a329f]'; // Purple
    if (p.includes('shopping')) return 'border-[#2a2a2a] text-[#2a2a2a]'; // Black
    return 'border-gray-300 text-gray-500';
};


// --- 4. Public Dashboard Components (Itinerary and Suggestion Form) ---

interface ItineraryListProps {
    places: TripPlace[];
    loading: boolean;
    error: string | null;
    currentDay: number;
}

const ItineraryList: React.FC<ItineraryListProps> = ({ places, loading, error, currentDay }) => {
    if (loading) {
        return (
            <div className="text-center py-10">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#6a329f]" />
                <p className="text-gray-500 mt-2">Fetching the itinerary...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-500 py-10 font-medium">
                <p>{error}</p>
            </div>
        );
    }

    const filteredPlaces = places
        .filter(place => place.day === currentDay)
        .sort((a, b) => a.time.localeCompare(b.time));

    if (filteredPlaces.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <MapPin className="w-8 h-8 mx-auto text-[#e3a1e9]" />
                <p className="mt-2">No plans made yet for Day {currentDay}.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {filteredPlaces.map(place => (
                <div key={place.id} className="bg-white p-3 border-l-4 rounded-xl shadow-md transition hover:shadow-lg"
                    style={{ borderLeftColor: getPurposeColor(place.purpose).split(' ')[0].replace('border-l', 'border') }}>
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-[#2a2a2a]">{place.name}</h3>
                        <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{place.time}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{place.purpose}</p>
                    {place.notes && (
                        <p className="text-xs text-gray-700 mt-2 italic bg-gray-50 p-2 rounded-lg">
                            {place.notes}
                        </p>
                    )}
                    <div className="text-right mt-2">
                         <button className="text-xs font-semibold px-2 py-1 rounded-md transition text-[#6a329f] hover:bg-[#f7e6f8]" 
                            onClick={() => openMap(place.latitude, place.longitude)}>
                            View Map
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const SuggestionForm: React.FC<{ refreshSuggestions: () => void }> = ({ refreshSuggestions }) => {
    const safeFetch = useApiFetcher();
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, color: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !text) return;

        setLoading(true);
        setMessage(null);

        try {
            const payload: Omit<Suggestion, 'id' | 'status' | 'createdAt'> = {
                userId: USER_ID,
                title,
                text,
            };

            await safeFetch('/suggestions', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, false); // Public endpoint, requiresAuth: false

            setMessage({ text: 'Suggestion sent! Thank you for the idea.', color: 'text-green-600' });
            setTitle('');
            setText('');
            refreshSuggestions(); 

        } catch (error: any) {
            console.error("Submission failed:", error);
            setMessage({ text: error.message || 'Submission failed. Please try again.', color: 'text-red-600' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border-t border-gray-100 bg-[#f7e6f8] rounded-b-xl">
            <h2 className="text-lg font-bold text-[#6a329f] mb-3 flex items-center">
                <Rabbit className="w-5 h-5 mr-1" />
                Submit a Wild Suggestion
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Suggestion Title (e.g., Cat Café)" 
                    required 
                    className="w-full p-2 border border-[#e3a1e9] rounded-lg focus:ring-2 focus:ring-[#6a329f] focus:border-transparent transition"
                    disabled={loading}
                />
                <textarea 
                    rows={2} 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Tell us why we MUST go here!" 
                    required 
                    className="w-full p-2 border border-[#e3a1e9] rounded-lg focus:ring-2 focus:ring-[#6a329f] focus:border-transparent transition"
                    disabled={loading}
                />
                <button 
                    type="submit" 
                    className={`w-full font-bold py-2 rounded-lg shadow-md transition transform ${loading ? 'bg-gray-400' : 'bg-[#e3a1e9] text-[#2a2a2a] hover:bg-[#ffc1ff] hover:scale-[1.01]'}`}
                    disabled={loading}
                >
                    {loading ? 'Sending...' : 'Send It to the Inbox'}
                </button>
            </form>
            {message && (
                <div className={`mt-3 text-sm text-center font-semibold ${message.color}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
};


// --- 5. Admin Dashboard Components ---

// Renamed and updated to handle the unified secret
const AuthLogin: React.FC<{ login: (secret: string) => void }> = ({ login }) => {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!secret) return;
        
        login(secret);
        setError('Secret set. Attempting to authorize backend...');
        
        setTimeout(() => setError('Login successful. Use Admin tabs.'), 1500);
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg w-full max-w-sm mx-auto my-10">
            <h3 className="text-xl font-bold text-[#6a329f] mb-4 flex items-center">
                <LogIn className="w-5 h-5 mr-2" />
                Admin / Trusted User Login
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter Secret Key"
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e3a1e9]"
                />
                <button
                    type="submit"
                    className="w-full bg-[#6a329f] text-white font-bold py-3 rounded-lg shadow-md hover:bg-[#8e45b5] transition"
                >
                    Authorize Access
                </button>
            </form>
            {error && <p className="mt-4 text-sm text-gray-500 text-center">{error}</p>}
        </div>
    );
};

// authSecret prop replaces adminSecret prop
const SuggestionInbox: React.FC<{ authSecret: string | null, refreshTrigger: number }> = ({ authSecret, refreshTrigger }) => {
    const safeFetch = useApiFetcher();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<SuggestionStatus | 'ALL'>('ALL');

    const fetchSuggestions = useCallback(async () => {
        if (!authSecret) {
            setError('Please authorize with a Secret Key.');
            setSuggestions([]);
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            const endpoint = filter === 'ALL' ? '/suggestions' : `/suggestions?status=${filter.toLowerCase()}`;
            // GET /api/suggestions requires 'admin' role
            const data: Suggestion[] = await safeFetch(endpoint, { method: 'GET' }, true); 
            setSuggestions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (err: any) {
            setError(err.message || 'Failed to fetch inbox. (Hint: Only Admin can view this list)');
        } finally {
            setLoading(false);
        }
    }, [safeFetch, authSecret, filter, refreshTrigger]);

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);


    const updateStatus = async (id: string, newStatus: SuggestionStatus) => {
        try {
            // PATCH /api/suggestions/:id requires 'admin' or 'trusted' role
            await safeFetch(`/suggestions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus.toLowerCase() })
            }, true);
            
            // Optimistically update UI
            setSuggestions(prev => prev.map(s => 
                s.id === id ? { ...s, status: newStatus } : s
            ).filter(s => filter === 'ALL' || s.status === filter));

        } catch (error: any) {
            alert(`Failed to update status: ${error.message}`);
        }
    };

    if (!authSecret) return <AuthLogin login={(s) => localStorage.setItem('auth_secret', s)} />;

    if (loading) return <div className="text-center py-10"><Loader2 className="w-8 h-8 mx-auto animate-spin text-[#6a329f]" /></div>;
    if (error) return <div className="text-center text-red-500 py-10 font-medium"><p>{error}</p><button onClick={fetchSuggestions} className="text-xs text-blue-500 mt-2 hover:underline">Retry</button></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-around bg-gray-100 p-2 rounded-lg">
                {(['ALL', SuggestionStatus.PENDING, SuggestionStatus.APPROVED, SuggestionStatus.REJECTED] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`text-sm font-semibold px-3 py-1 rounded-full transition ${filter === s ? 'bg-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        {s} ({suggestions.filter(sug => s === 'ALL' || sug.status === s).length})
                    </button>
                ))}
            </div>
            
            {suggestions.length === 0 && <p className="text-center text-gray-500 py-4">No suggestions found for this filter.</p>}

            <div className="space-y-4">
                {suggestions.map(s => (
                    <div key={s.id} className={`p-4 rounded-xl shadow-md border-l-4 ${s.status === 'PENDING' ? 'border-yellow-500' : s.status === 'APPROVED' ? 'border-green-500' : 'border-red-500'} bg-white`}>
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-lg">{s.title}</h4>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : s.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {s.status}
                            </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{s.text}</p>
                        <p className="text-xs text-gray-400 mt-1">By User ID: {s.userId.substring(0, 8)}...</p>
                        
                        <div className="mt-3 space-x-2 text-right">
                            {s.status !== 'APPROVED' && (
                                <button 
                                    onClick={() => updateStatus(s.id, SuggestionStatus.APPROVED)} 
                                    className="text-xs font-semibold px-3 py-1 rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition">
                                    Approve
                                </button>
                            )}
                            {s.status !== 'REJECTED' && (
                                <button 
                                    onClick={() => updateStatus(s.id, SuggestionStatus.REJECTED)} 
                                    className="text-xs font-semibold px-3 py-1 rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition">
                                    Reject
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// authSecret prop replaces adminSecret prop
interface ItineraryFormProps {
    authSecret: string | null;
    refreshItinerary: () => void;
    editingPlace: TripPlace | null; 
    setEditingPlace: (place: TripPlace | null) => void;
}

const ItineraryForm: React.FC<ItineraryFormProps> = ({ authSecret, refreshItinerary, editingPlace, setEditingPlace }) => {
    const safeFetch = useApiFetcher();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<TripPlace, 'id'>>(initialTripPlaceFormData);

    const isEditing = !!editingPlace;

    useEffect(() => {
        if (editingPlace) {
            const { id, ...rest } = editingPlace;
            setFormData(rest);
        } else {
            setFormData(initialTripPlaceFormData);
        }
    }, [editingPlace]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (type === 'number' && name !== 'day') ? parseFloat(value) : (name === 'day' ? parseInt(value) : value),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authSecret) return;

        setLoading(true);
        setMessage(null);

        try {
            const method = isEditing ? 'PUT' : 'POST';
            const endpoint = isEditing ? `/itinerary/${editingPlace!.id}` : '/itinerary';

            // POST and PUT require 'admin' or 'trusted' role
            await safeFetch(endpoint, {
                method: method,
                body: JSON.stringify(formData)
            }, true);

            setMessage(`Place ${isEditing ? 'updated' : 'added'} successfully!`);
            refreshItinerary();

            if (!isEditing) {
                setFormData(initialTripPlaceFormData);
            } else {
                setEditingPlace(null);
            }

        } catch (error: any) {
            setMessage(`Failed to ${isEditing ? 'update' : 'add'} place: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!authSecret) return <AuthLogin login={(s) => localStorage.setItem('auth_secret', s)} />;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-[#6a329f] mb-4 flex items-center">
                {isEditing ? <Edit className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                {isEditing ? 'Edit Itinerary Place' : 'Add New Itinerary Place'}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
                <select name="day" value={formData.day} onChange={handleChange} required 
                        className="p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]">
                    {[1, 2, 3, 4].map(d => <option key={d} value={d}>Day {d}</option>)}
                </select>
                <input type="time" name="time" value={formData.time} onChange={handleChange} required 
                       className="p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />
            </div>

            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Location Name" required 
                   className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />
            <input type="text" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="Purpose (e.g., Dinner, Shopping)" required 
                   className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />
            
            <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notes (Optional directions or details)" rows={2}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />

            <div className="grid grid-cols-2 gap-4">
                <input type="number" name="latitude" value={formData.latitude} onChange={handleChange} placeholder="Latitude (0.0)" step="0.00001" required 
                       className="p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />
                <input type="number" name="longitude" value={formData.longitude} onChange={handleChange} placeholder="Longitude (0.0)" step="0.00001" required 
                       className="p-3 border rounded-lg focus:ring-2 focus:ring-[#e3a1e9]" />
            </div>
            
            <div className="flex space-x-2">
                <button
                    type="submit"
                    className={`flex-grow font-bold py-3 rounded-lg shadow-md transition ${loading ? 'bg-gray-400' : 'bg-[#e3a1e9] text-[#2a2a2a] hover:bg-[#ffc1ff]'}`}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create New Place')}
                </button>
                {isEditing && (
                    <button
                        type="button"
                        onClick={() => setEditingPlace(null)}
                        className="font-bold py-3 px-4 rounded-lg shadow-md transition bg-gray-200 text-gray-700 hover:bg-gray-300"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
            </div>
            
            {message && <p className={`mt-3 text-sm text-center font-semibold ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
        </form>
    );
};


// authSecret prop replaces adminSecret prop
interface ItineraryManagerProps {
    authSecret: string | null;
    itinerary: TripPlace[];
    refreshItinerary: () => void;
    setEditingPlace: (place: TripPlace | null) => void;
}

const ItineraryManager: React.FC<ItineraryManagerProps> = ({ authSecret, itinerary, refreshItinerary, setEditingPlace }) => {
    const safeFetch = useApiFetcher();

    const handleDelete = async (id: string) => {
        // DELETE is ADMIN-ONLY protected on the backend
        if (!confirm('Are you sure you want to delete this itinerary place? This action requires Admin privileges.')) return;
        
        try {
            // DELETE /api/itinerary/:id requires 'admin' role
            await safeFetch(`/itinerary/${id}`, { method: 'DELETE' }, true);
            refreshItinerary();
        } catch (error: any) {
            alert(`Failed to delete place: ${error.message}`);
        }
    };

    const sortedItinerary = itinerary.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.time.localeCompare(b.time);
    });

    if (!authSecret) return <AuthLogin login={(s) => localStorage.setItem('auth_secret', s)} />;
    
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-[#6a329f] mb-4 flex items-center">
                <ListOrdered className="w-5 h-5 mr-2" /> Current Itinerary ({sortedItinerary.length} Places)
            </h3>
            
            <div className="max-h-[300px] overflow-y-auto space-y-3 p-2 bg-gray-50 rounded-lg">
                {sortedItinerary.length === 0 && <p className="text-center text-gray-500 py-4">No places in the itinerary yet.</p>}
                
                {sortedItinerary.map(place => (
                    <div key={place.id} className="p-3 bg-white rounded-lg shadow-sm flex justify-between items-center border-l-4 border-[#e3a1e9]">
                        <div>
                            <p className="font-semibold text-sm">{place.time} (Day {place.day})</p>
                            <p className="font-bold text-lg">{place.name}</p>
                            <p className="text-xs text-gray-500">{place.purpose}</p>
                        </div>
                        <div className="space-x-2 flex">
                            <button
                                onClick={() => setEditingPlace(place)}
                                className="p-2 rounded-full text-blue-600 hover:bg-blue-50 transition"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(place.id)}
                                className="p-2 rounded-full text-red-600 hover:bg-red-50 transition"
                                title="Admin only action"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// authSecret prop replaces adminSecret prop
const AdminPanel: React.FC<{ refreshItinerary: () => void, refreshSuggestions: () => void, authSecret: string | null, itinerary: TripPlace[] }> = ({ refreshItinerary, refreshSuggestions, authSecret, itinerary }) => {
    const [activeTab, setActiveTab] = useState<'inbox' | 'form' | 'manager'>('form');
    const [editingPlace, setEditingPlace] = useState<TripPlace | null>(null);
    const [suggestionRefreshTrigger, setSuggestionRefreshTrigger] = useState(0);

    const handleRefreshItinerary = () => {
        refreshItinerary();
        setSuggestionRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
        if (editingPlace) {
            setActiveTab('form');
        }
    }, [editingPlace]);

    useEffect(() => {
        if (activeTab !== 'form') {
            setEditingPlace(null);
        }
    }, [activeTab]);


    return (
        <div className="p-4 bg-[#f7e6f8] min-h-[500px]">
            <h2 className="text-2xl font-extrabold text-[#6a329f] mb-4 text-center">Admin Panel</h2>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-4 border-b border-[#e3a1e9]/50">
                <button
                    onClick={() => setActiveTab('form')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'form' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <PlusCircle className="w-5 h-5 mr-2" /> {editingPlace ? 'Edit Place' : 'Add/Edit Form'}
                </button>
                <button
                    onClick={() => setActiveTab('manager')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'manager' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <ListOrdered className="w-5 h-5 mr-2" /> Itinerary Manager
                </button>
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'inbox' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <Inbox className="w-5 h-5 mr-2" /> Suggestion Inbox
                </button>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'form' && (
                <ItineraryForm 
                    authSecret={authSecret} 
                    refreshItinerary={handleRefreshItinerary} 
                    editingPlace={editingPlace}
                    setEditingPlace={setEditingPlace}
                />
            )}
            
            {activeTab === 'manager' && (
                <ItineraryManager 
                    authSecret={authSecret} 
                    itinerary={itinerary}
                    refreshItinerary={handleRefreshItinerary} 
                    setEditingPlace={setEditingPlace}
                />
            )}
            
            {activeTab === 'inbox' && (
                <SuggestionInbox 
                    authSecret={authSecret} 
                    refreshTrigger={suggestionRefreshTrigger} 
                />
            )}
        </div>
    );
};


// --- 6. Main App Component (Renamed to default export for Next.js page) ---

const App: React.FC = () => {
    const safeFetch = useApiFetcher();
    const [itinerary, setItinerary] = useState<TripPlace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDay, setCurrentDay] = useState(1);
    const [view, setView] = useState<'public' | 'admin'>('public'); 
    
    // Auth state renamed and uses 'auth_secret' in localStorage
    const [authSecret, setAuthSecret] = useState<string | null>(
        typeof window !== 'undefined' ? localStorage.getItem('auth_secret') : null
    );
    
    // Fetch itinerary data
    const fetchItinerary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data: TripPlace[] = await safeFetch('/itinerary', { method: 'GET' }, false); // Public read
            setItinerary(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load itinerary data.');
        } finally {
            setLoading(false);
        }
    }, [safeFetch]);

    useEffect(() => {
        fetchItinerary();
    }, [fetchItinerary]);
    
    const login = (secret: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_secret', secret);
            setAuthSecret(secret);
        }
    };

    const logout = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_secret');
            setAuthSecret(null);
            setView('public'); 
        }
    };

    const refreshSuggestions = () => {
        // Placeholder refresh, actual refresh is handled by trigger in AdminPanel
    };

    return (
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden min-h-screen mx-auto">
            
            {/* Header */}
            <header className="bg-[#2a2a2a] text-white p-4 flex items-center justify-between rounded-t-xl">
                <h1 className="text-xl font-extrabold flex items-center">
                    <MapPin className="w-6 h-6 mr-2 text-[#e3a1e9]" />
                    Kuromi's Chaos Trip
                </h1>
                <button 
                    onClick={() => {
                        if (view === 'admin' && authSecret) {
                            logout();
                        } else {
                            setView(view === 'public' ? 'admin' : 'public');
                        }
                    }} 
                    className={`text-sm px-3 py-1 rounded-lg transition ${view === 'public' ? 'bg-[#6a329f] hover:bg-[#8e45b5]' : 'bg-red-500 hover:bg-red-700'}`}
                >
                    {view === 'public' ? 'Login / Admin' : (authSecret ? 'Logout' : 'Public View')}
                </button>
            </header>

            {/* Render Admin Panel or Public Dashboard */}
            {view === 'admin' ? (
                <AdminPanel 
                    refreshItinerary={fetchItinerary} 
                    refreshSuggestions={refreshSuggestions}
                    authSecret={authSecret} 
                    itinerary={itinerary}
                />
            ) : (
                <>
                    {/* Day Filter Navigation (Public View Only) */}
                    <nav className="p-4 bg-[#e3a1e9]/50 flex justify-between space-x-2">
                        {[1, 2, 3, 4].map(day => (
                            <button
                                key={day}
                                onClick={() => setCurrentDay(day)}
                                className={`px-3 py-1 text-sm font-semibold rounded-full shadow-md transition ${currentDay === day ? 'bg-[#2a2a2a] text-white' : 'bg-white text-[#2a2a2a] hover:bg-gray-100'}`}
                            >
                                Day {day}
                            </button>
                        ))}
                    </nav>

                    {/* Itinerary Display */}
                    <main className="p-4 h-[calc(100vh-280px)] overflow-y-auto scrollbar-pink">
                        <ItineraryList 
                            places={itinerary} 
                            loading={loading} 
                            error={error} 
                            currentDay={currentDay} 
                        />
                    </main>

                    {/* Suggestion Submission Form */}
                    <SuggestionForm refreshSuggestions={refreshSuggestions} />
                </>
            )}
        </div>
    );
};

export default App;
