"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Rabbit, Loader2, ListOrdered, Inbox, PlusCircle, Trash2, Edit, LogIn, Heart } from 'lucide-react';

// Load Tailwind CSS for styling
// Note: In a real Next.js environment, this would be handled via setup.
// We include the Tailwind CDN script for standalone runnable demo purposes.
const TailwindScript = () => (
    <script src="https://cdn.tailwindcss.com"></script>
);

// --- 1. Constants and Type Definitions ---

const API_BASE_URL = '/api';
const USER_ID = typeof window !== 'undefined' ? (localStorage.getItem('user_id') || crypto.randomUUID()) : 'server-user';
if (typeof window !== 'undefined') {
    localStorage.setItem('user_id', USER_ID);
}

// Mock Secrets for Client-side Role Determination (must match backend expectation)
const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET!;
const TRUSTED_SECRET = process.env.NEXT_PUBLIC_TRUSTED_SECRET!; 

type Role = 'admin' | 'trusted' | 'guest';

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

// Initial state for the form
const initialTripPlaceFormData: Omit<TripPlace, 'id'> = {
    day: 1, 
    time: '12:00', 
    name: '', 
    purpose: '', 
    notes: '', 
    latitude: 0, 
    longitude: 0
};

// --- 2. Custom Hooks and Utilities ---

// Custom hook to handle API calls, including the unified authorization header
const useApiFetcher = (authSecret: string | null) => {
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
                    throw new Error('Authorization Failed (403): Invalid secret or insufficient privileges.');
                }
                
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({ error: 'Unknown server error' }));
                    throw new Error(errorBody.error || `HTTP error! Status: ${response.status}`);
                }
                
                // Handle 204 No Content response for DELETE/PATCH
                if (response.status === 204 || response.headers.get('content-length') === '0') {
                    return {};
                }

                return response.json();

            } catch (error: any) {
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

const openMap = (lat: number, lon: number) => {
    if (typeof window !== 'undefined') {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        window.open(mapUrl, '_blank');
    }
};

const getPurposeColor = (purpose: string): string => {
    const p = purpose.toLowerCase();
    if (p.includes('food') || p.includes('dinner') || p.includes('cafe')) return 'border-[#e3a1e9] text-[#e3a1e9]'; // Kuromi Pink
    if (p.includes('sightseeing') || p.includes('tour')) return 'border-[#6a329f] text-[#6a329f]'; // Kuromi Purple
    if (p.includes('shopping') || p.includes('store')) return 'border-[#2a2a2a] text-[#2a2a2a]'; // Kuromi Black
    return 'border-gray-300 text-gray-500';
};

// --- 3. Shared UI Components ---

interface MessageDialogProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

// Custom Modal/Dialog replacement for alert/confirm
const MessageDialog: React.FC<MessageDialogProps> = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="text-lg font-bold text-red-600">Action Required</h4>
            <p className="text-gray-700">{message}</p>
            <div className="flex justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                >
                    Confirm Delete
                </button>
            </div>
        </div>
    </div>
);


interface ItineraryListProps {
    places: TripPlace[];
    loading: boolean;
    error: string | null;
    currentDay: number;
    // For admin/trusted view, allow edit/delete actions if role is admin
    role: Role; 
    setEditingPlace?: (place: TripPlace | null) => void;
    onDelete?: (id: string) => void;
}

const ItineraryList: React.FC<ItineraryListProps> = ({ places, loading, error, currentDay, role, setEditingPlace, onDelete }) => {
    const isAdmin = role === 'admin';
    
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
                <div 
                    key={place.id} 
                    className="bg-white p-4 border-l-4 rounded-xl shadow-md transition hover:shadow-lg"
                    style={{ borderLeftColor: getPurposeColor(place.purpose).split(' ')[0].replace('border-', '') }}
                >
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
                    <div className={`mt-2 flex items-center ${isAdmin ? 'justify-between' : 'justify-end'}`}>
                        <button className="text-xs font-semibold px-2 py-1 rounded-md transition text-[#6a329f] hover:bg-[#f7e6f8]" 
                            onClick={() => openMap(place.latitude, place.longitude)}>
                            View Map
                        </button>
                        
                        {/* Admin Action Buttons (Edit/Delete) - only show here if we are NOT in the AdminPanel */}
                        {/* Since MainItineraryView hides this, this block is mostly illustrative but kept for completeness based on original intent */}
                        {isAdmin && setEditingPlace && onDelete && (
                             <div className="space-x-2 flex">
                                 <button
                                     onClick={() => setEditingPlace(place)}
                                     className="p-1 rounded-full text-[#e3a1e9] hover:bg-[#f7e6f8] transition"
                                 >
                                     <Edit className="w-4 h-4" />
                                 </button>
                                 <button
                                     onClick={() => onDelete(place.id)}
                                     className="p-1 rounded-full text-red-500 hover:bg-red-50 transition"
                                 >
                                     <Trash2 className="w-4 h-4" />
                                 </button>
                             </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 4. Login Screen Component ---

const LoginScreen: React.FC<{ setRole: (role: Role, secret: string) => void }> = ({ setRole }) => {
    const [secret, setSecret] = useState('');
    const [message, setMessage] = useState<{ text: string, color: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        
        // Client-side simulation of secret check
        setTimeout(() => {
            if (secret === ADMIN_SECRET) {
                setRole('admin', secret);
                setMessage({ text: 'Welcome，Kuromi Boss 😎😎', color: 'text-green-600' });
            } else if (secret === TRUSTED_SECRET) {
                setRole('trusted', secret);
                setMessage({ text: 'babyyyy～想死你啦 ❤️❤️', color: 'text-[#e3a1e9]' });
            } else {
                setMessage({ text: '暗号输入错误，请用爱重新登录～🥺🥺💔', color: 'text-red-500' });
            }
            setLoading(false);
        }, 500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7e6f8] p-4">
            <div className="p-8 bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto text-center border-4 border-[#e3a1e9]">
                <div className="mb-6">
                    <img 
                        src="/kuromi-avatar-login-2.png" 
                        alt="Kuromi Avatar" 
                        className="w-40 h-auto mx-auto drop-shadow-lg" 
                    />
                    <p className="text-xl font-extrabold text-[#6a329f] mt-2">四天三夜 与你共度每一瞬间💞</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="输入我们之间的暗号"
                        required
                        className="w-full p-3 border border-[#e3a1e9] rounded-lg focus:ring-2 focus:ring-[#6a329f] focus:border-transparent transition text-center font-mono"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className={`w-full font-bold py-3 rounded-lg shadow-md transition transform ${loading ? 'bg-gray-400' : 'bg-[#6a329f] text-white hover:bg-[#8e45b5] hover:scale-[1.01]'}`}
                        disabled={loading}
                    >
                        {loading ? '检查中 🔍 ' : ' 登入 💌 '}
                    </button>
                </form>
                {message && (
                    <div className={`mt-4 text-sm font-semibold ${message.color}`}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 5. Trusted User Dashboard Components (Suggestion Form) ---

const SuggestionForm: React.FC<{ refreshSuggestions: () => void, authSecret: string }> = ({ refreshSuggestions, authSecret }) => {
    const safeFetch = useApiFetcher(authSecret);
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
            }, true); // Requires authSecret but doesn't check role

            setMessage({ text: '建议已成功发送！嘻嘻 ❤️', color: 'text-green-600' });
            setTitle('');
            setText('');
            refreshSuggestions(); 

        } catch (error: any) {
            console.error("Submission failed:", error);
            setMessage({ text: error.message || '提交失败。请再试一次。😭😭', color: 'text-red-600' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 border-t border-gray-100 bg-[#f7e6f8] rounded-b-xl">
            <h2 className="text-lg font-bold text-[#6a329f] mb-3 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-[#e3a1e9]" />
                提交你最疯狂的建议 😳😳
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="建议标题（例如：猫咖啡馆）" 
                    required 
                    className="w-full p-2 border border-[#e3a1e9] rounded-lg focus:ring-2 focus:ring-[#6a329f] focus:border-transparent transition"
                    disabled={loading}
                />
                <textarea 
                    rows={2} 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="我一定要去这里的理由！" 
                    required 
                    className="w-full p-2 border border-[#e3a1e9] rounded-lg focus:ring-2 focus:ring-[#6a329f] focus:border-transparent transition"
                    disabled={loading}
                />
                <button 
                    type="submit" 
                    className={`w-full font-bold py-2 rounded-lg shadow-md transition transform ${loading ? 'bg-gray-400' : 'bg-[#e3a1e9] text-[#2a2a2a] hover:bg-[#ffc1ff] hover:scale-[1.01]'}`}
                    disabled={loading}
                >
                    {loading ? '发送中...' : '发送到信箱 💌'}
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

// --- 6. Admin Panel Components (CRUD & Inbox) ---

const SuggestionInbox: React.FC<{ authSecret: string, refreshTrigger: number }> = ({ authSecret, refreshTrigger }) => {
    const safeFetch = useApiFetcher(authSecret);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<SuggestionStatus | 'ALL'>('ALL');

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            // This endpoint requires Admin role on the backend
            const endpoint = filter === 'ALL' ? '/suggestions' : `/suggestions?status=${filter.toLowerCase()}`;
            const data: Suggestion[] = await safeFetch(endpoint, { method: 'GET' }, true); 
            setSuggestions(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } catch (err: any) {
            setError(err.message || 'Failed to fetch inbox. (Hint: Only Admin can view this list)');
            setSuggestions([]); // Clear on error
        } finally {
            setLoading(false);
        }
    }, [safeFetch, filter, refreshTrigger]);

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);


    const updateStatus = async (id: string, newStatus: SuggestionStatus) => {
        try {
            await safeFetch(`/suggestions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus.toLowerCase() })
            }, true);
            
            // Optimistically update UI
            setSuggestions(prev => prev.map(s => 
                s.id === id ? { ...s, status: newStatus } : s
            ).filter(s => filter === 'ALL' || s.status === filter));

        } catch (error: any) {
            // Replace alert with message state if needed, or rely on fetcher error
            console.error(`Failed to update status: ${error.message}`);
        }
    };

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
                            {/* R/U/D allowed for Admin */}
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

interface ItineraryFormProps {
    authSecret: string;
    refreshItinerary: () => void;
    editingPlace: TripPlace | null; 
    setEditingPlace: (place: TripPlace | null) => void;
}

const ItineraryForm: React.FC<ItineraryFormProps> = ({ authSecret, refreshItinerary, editingPlace, setEditingPlace }) => {
    const safeFetch = useApiFetcher(authSecret);
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

        setLoading(true);
        setMessage(null);

        try {
            const method = isEditing ? 'PUT' : 'POST';
            const endpoint = isEditing ? `/itinerary/${editingPlace!.id}` : '/itinerary';

            // POST and PUT require Admin role on the backend
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

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-xl shadow-lg border border-[#e3a1e9]/50">
            <h3 className="text-xl font-bold text-[#6a329f] mb-4 flex items-center">
                {isEditing ? <Edit className="w-5 h-5 mr-2" /> : <PlusCircle className="w-5 h-5 mr-2" />}
                {isEditing ? 'Edit Itinerary Place' : 'Add New Itinerary Place (CRUD)'}
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

// ItineraryManager is now mostly a data manager for Admin's CRUD actions
const ItineraryManager: React.FC<{ authSecret: string, itinerary: TripPlace[], refreshItinerary: () => void, setEditingPlace: (place: TripPlace | null) => void }> = ({ authSecret, itinerary, refreshItinerary, setEditingPlace }) => {
    const safeFetch = useApiFetcher(authSecret);
    const [placeToDelete, setPlaceToDelete] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setPlaceToDelete(id);
    };

    const confirmDelete = async () => {
        if (!placeToDelete) return;

        try {
            // DELETE requires Admin role on the backend
            await safeFetch(`/itinerary/${placeToDelete}`, { method: 'DELETE' }, true);
            refreshItinerary();
            // Show success message (optional)
        } catch (error: any) {
            console.error(`Failed to delete place: ${error.message}`);
            // Show failure message (optional)
        } finally {
            setPlaceToDelete(null);
        }
    };
    
    return (
        <>
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-[#6a329f] mb-4 flex items-center">
                    <ListOrdered className="w-5 h-5 mr-2" /> All Itinerary Items
                </h3>
                
                <div className="max-h-[300px] overflow-y-auto space-y-3 p-2 bg-gray-50 rounded-lg">
                    {itinerary.length === 0 && <p className="text-center text-gray-500 py-4">No places in the itinerary yet.</p>}
                    
                    {itinerary.map(place => (
                        <div key={place.id} className="p-3 bg-white rounded-lg shadow-sm flex justify-between items-center border-l-4 border-[#e3a1e9]">
                            <div>
                                <p className="font-semibold text-sm">{place.time} (Day {place.day})</p>
                                <p className="font-bold text-lg">{place.name}</p>
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
            {placeToDelete && (
                <MessageDialog
                    message="Are you sure you want to delete this itinerary place? This action is permanent and requires Admin privileges."
                    onConfirm={confirmDelete}
                    onCancel={() => setPlaceToDelete(null)}
                />
            )}
        </>
    );
};

// AdminPanel for Admin-specific CRUD/RUD actions
const AdminPanel: React.FC<{ refreshItinerary: () => void, refreshSuggestions: () => void, authSecret: string, itinerary: TripPlace[] }> = ({ refreshItinerary, refreshSuggestions, authSecret, itinerary }) => {
    const [activeTab, setActiveTab] = useState<'form' | 'manager' | 'inbox'>('form');
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
            <h2 className="text-2xl font-extrabold text-[#6a329f] mb-4 text-center">Kuromi Admin Panel</h2>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-6 border-b border-[#e3a1e9]/50">
                <button
                    onClick={() => setActiveTab('form')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'form' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <PlusCircle className="w-5 h-5 mr-2" /> {editingPlace ? 'Edit Place' : 'Itinerary Form'}
                </button>
                <button
                    onClick={() => setActiveTab('manager')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'manager' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <ListOrdered className="w-5 h-5 mr-2" /> Manage All
                </button>
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex items-center px-4 py-2 font-semibold transition ${activeTab === 'inbox' ? 'border-b-4 border-[#e3a1e9] text-[#2a2a2a]' : 'text-gray-500 hover:text-[#6a329f]'}`}
                >
                    <Inbox className="w-5 h-5 mr-2" /> Suggestion Inbox
                </button>
            </div>

            {/* Content Switch */}
            <div>
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
        </div>
    );
};


// --- 7. Main Itinerary View Component (Shared by all roles) ---

interface MainItineraryViewProps {
    role: Role;
    itinerary: TripPlace[];
    loading: boolean;
    error: string | null;
    authSecret: string;
    refreshItinerary: () => void;
}

const MainItineraryView: React.FC<MainItineraryViewProps> = ({ role, itinerary, loading, error, authSecret, refreshItinerary }) => {
    // Determine the max day planned in the itinerary, defaulting to 1 for the start
    const maxDay = useMemo(() => itinerary.reduce((max, place) => Math.max(max, place.day), 1), [itinerary]);
    const [currentDay, setCurrentDay] = useState(1);
    const [showSuggestionForm, setShowSuggestionForm] = useState(false);
    const [suggestionRefreshTrigger, setSuggestionRefreshTrigger] = useState(0);

    useEffect(() => {
        // Ensure currentDay is valid after fetching or updating itinerary
        if (currentDay > maxDay && maxDay > 0) {
            setCurrentDay(maxDay);
        } else if (currentDay === 0 && maxDay > 0) {
            setCurrentDay(1);
        }
    }, [maxDay, currentDay]);

    const dayButtons = Array.from({ length: maxDay }, (_, i) => i + 1);

    const handleRefreshSuggestions = () => {
        setSuggestionRefreshTrigger(prev => prev + 1);
    };
    
    return (
        <div className="p-4 sm:p-6 bg-white min-h-[calc(100vh-64px)] rounded-b-3xl shadow-xl border-t-4 border-[#e3a1e9]/50">
            <h1 className="text-3xl font-extrabold text-[#6a329f] text-center mb-6 border-b-2 border-[#e3a1e9]/50 pb-2">
                我们的四天之旅 💜
            </h1>

            {/* Day Selector Tabs */}
            <div className="flex justify-center flex-wrap gap-2 mb-6">
                {dayButtons.map(day => (
                    <button
                        key={day}
                        onClick={() => setCurrentDay(day)}
                        className={`px-4 py-2 text-sm font-bold rounded-full transition transform hover:scale-105 shadow-md ${
                            currentDay === day 
                                ? 'bg-[#e3a1e9] text-[#2a2a2a] ring-2 ring-[#6a329f]' 
                                : 'bg-gray-100 text-gray-600 hover:bg-[#f7e6f8]'
                        }`}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            {/* Itinerary List */}
            <div className="max-w-3xl mx-auto">
                <ItineraryList 
                    places={itinerary} 
                    loading={loading} 
                    error={error} 
                    currentDay={currentDay}
                    role={'guest'} // Non-admin users view the itinerary in 'guest' mode (no inline CRUD buttons)
                />
            </div>

            {/* Trusted User: Suggestion Form */}
            {role === 'trusted' && (
                <div className="mt-8 max-w-3xl mx-auto bg-gray-50 rounded-xl shadow-2xl border border-[#e3a1e9]/50">
                    <button
                        onClick={() => setShowSuggestionForm(prev => !prev)}
                        className="w-full flex items-center justify-center p-4 text-lg font-bold text-[#6a329f] hover:bg-[#f7e6f8] rounded-t-xl transition"
                    >
                        <Rabbit className={`w-5 h-5 mr-3 transition transform ${showSuggestionForm ? 'rotate-90' : ''}`} />
                        {showSuggestionForm ? '隐藏意见箱' : 'babbyyy～有什么想去的地方吗？💗 (点这里嘿嘿)'}
                    </button>
                    {showSuggestionForm && (
                        <SuggestionForm authSecret={authSecret} refreshSuggestions={handleRefreshSuggestions} />
                    )}
                </div>
            )}
        </div>
    );
};


// --- 8. Main App Component (Authentication and Data Fetching) ---

const App: React.FC = () => {
    // Initial state setup using localStorage for persistence (simulating auth)
    const initialRole = typeof window !== 'undefined' ? (localStorage.getItem('role') as Role || 'guest') : 'guest';
    const initialSecret = typeof window !== 'undefined' ? (localStorage.getItem('auth_secret') || null) : null;

    const [role, setRoleState] = useState<Role>(initialRole);
    const [authSecret, setAuthSecret] = useState<string | null>(initialSecret);
    const [itinerary, setItinerary] = useState<TripPlace[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const safeFetch = useApiFetcher(authSecret);

    // Function to handle role setting and persist to localStorage
    const setRoleAndSecret = useCallback((newRole: Role, newSecret: string) => {
        setRoleState(newRole);
        setAuthSecret(newSecret);
        if (typeof window !== 'undefined') {
            localStorage.setItem('role', newRole);
            localStorage.setItem('auth_secret', newSecret);
        }
    }, []);
    
    // Function to handle logout (revert to guest)
    const handleLogout = useCallback(() => {
        setRoleState('guest');
        setAuthSecret(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('role');
            localStorage.removeItem('auth_secret');
        }
    }, []);


    // Fetch Itinerary function
    const fetchItinerary = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Fetch itinerary, passing authSecret if available
            const data: TripPlace[] = await safeFetch('/itinerary', { method: 'GET' }, !!authSecret);
            setItinerary(data);

        } catch (err: any) {
            setError(err.message || 'Failed to load itinerary.');
        } finally {
            setLoading(false);
        }
    }, [safeFetch, authSecret]);

    // Initial load and dependency on authSecret
    useEffect(() => {
        // Only fetch if we have an auth status (even guest mode has an implied auth state)
        fetchItinerary();
    }, [fetchItinerary]); 

    if (role === 'guest' && !authSecret) {
        return <LoginScreen setRole={setRoleAndSecret} />;
    }

    return (
        <div className="min-h-screen bg-[#f7e6f8] font-sans">
            <TailwindScript />
            <header className="bg-white shadow-lg sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center">
                        <img 
                            src="kuromi-avatar-login-1.png" 
                            alt="Kuromi Avatar" 
                            className="w-20 h-20 mr-5 rounded-full border-2 border-purple-500 shadow-md object-cover"
                        />
                        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                            行程策划🚗💨
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className={`text-sm font-semibold px-3 py-1 rounded-full shadow-inner ${
                            role === 'admin' ? 'bg-[#6a329f] text-white' : role === 'trusted' ? 'bg-[#e3a1e9] text-[#2a2a2a]' : 'bg-gray-200 text-gray-700'
                        }`}>
                            {role === 'admin' ? 'BF' : role === 'trusted' ? 'BAE 💗' : role.toUpperCase()}
                        </span>
                        {(role === 'admin' || role === 'trusted') && (
                            <button 
                                onClick={handleLogout} 
                                className="flex items-center text-sm font-semibold text-gray-700 hover:text-red-500 transition"
                            >
                                <LogIn className="w-4 h-4 mr-1" />
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto pt-6 pb-12 px-4 sm:px-6 lg:px-8">
                {role === 'admin' ? (
                    // Admin Panel View - Full CRUD and Inbox
                    <AdminPanel 
                        authSecret={authSecret!}
                        itinerary={itinerary}
                        refreshItinerary={fetchItinerary}
                        refreshSuggestions={fetchItinerary} // Reuse itinerary refresh to trigger SuggestionInbox re-fetch
                    />
                ) : (
                    // Trusted/Guest User View - Itinerary and Suggestion Form (for Trusted)
                    <MainItineraryView 
                        role={role} 
                        itinerary={itinerary} 
                        loading={loading} 
                        error={error} 
                        authSecret={authSecret || ''}
                        refreshItinerary={fetchItinerary}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
