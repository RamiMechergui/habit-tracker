import React, { useState, useEffect, useRef } from 'react';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { format } from 'date-fns';
import {
  Plus, Trash2, Pencil, X, Gift, ExternalLink, ImageOff,
  ShoppingBag, Link as LinkIcon, AlertTriangle, ChevronDown, ShoppingCart, CheckCircle2
} from 'lucide-react';

const CURRENCY_OPTIONS = [
  { code: 'TND', symbol: 'DT', label: 'TND (DT)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'CAD', symbol: 'CA$', label: 'CAD (CA$)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF (Fr)' },
  { code: 'CNY', symbol: '¥', label: 'CNY (¥)' },
];

const CURRENCY_MAP = Object.fromEntries(CURRENCY_OPTIONS.map(c => [c.code, c]));

const formatPrice = (n, currencyCode = 'TND') => {
  if (n == null || n === '') return '';
  const cfg = CURRENCY_MAP[currencyCode] || CURRENCY_MAP.TND;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(Number(n));
  } catch {
    return cfg.symbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

export default function Wishlist() {
  const { wishlist, fetchWishlist, addWishlistItem, updateWishlistItem, deleteWishlistItem, buyWishlistItem, getLog, saveLog } = useHabits();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [currency, setCurrency] = useState('TND');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [boughtFilter, setBoughtFilter] = useState('active');

  // Buy modal state
  const [buyItem, setBuyItem] = useState(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  const fileRef = useRef(null);

  useEffect(() => { fetchWishlist().then(() => setLoading(false)); }, []); // eslint-disable-line

  const openAdd = () => {
    setEditItem(null);
    setName('');
    setPrice('');
    setUrl('');
    setCurrency('TND');
    setPhotoFile(null);
    setPhotoPreview('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setName(item.name);
    setPrice(item.price != null ? String(item.price) : '');
    setUrl(item.url || '');
    setCurrency(item.currency || 'TND');
    setPhotoFile(null);
    setPhotoPreview(item.photoUrl || '');
    setError('');
    setShowModal(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editItem) {
        await updateWishlistItem(editItem._id, { name: name.trim(), price, url, currency, photoFile, existingPhoto: photoFile ? undefined : (photoPreview || '') });
      } else {
        await addWishlistItem({ name: name.trim(), price, url, currency, photoFile });
      }
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (item) => {
    setDeleteConfirmId(item._id);
  };

  const executeDelete = async (item) => {
    try {
      await deleteWishlistItem(item._id);
    } catch { }
    setDeleteConfirmId(null);
  };

  const openBuy = (item) => {
    setBuyItem(item);
    setBuyPrice(item.price != null ? String(item.price) : '');
    setBuyError('');
    setBuying(false);
  };

  const handleBuy = async () => {
    const actualPrice = parseFloat(buyPrice);
    if (!actualPrice || actualPrice <= 0) {
      setBuyError('Enter a valid price');
      return;
    }
    setBuying(true);
    setBuyError('');
    try {
      const bought = await buyWishlistItem(buyItem._id, actualPrice);
      // Cross-post to expenses
      const today = format(new Date(), 'yyyy-MM-dd');
      const log = getLog(today) || { expenses: [] };
      const expenses = Array.isArray(log.expenses) ? [...log.expenses] : [];
      expenses.push({
        desc: bought.name,
        category: 'Wishlist Purchase',
        amount: actualPrice,
        time: format(new Date(), 'HH:mm'),
        cigarettesCount: 0,
      });
      // Ensure income is preserved
      const updatedLog = { ...log, expenses };
      await saveLog(today, updatedLog);
      setBuyItem(null);
    } catch (err) {
      setBuyError(err.message);
    } finally {
      setBuying(false);
    }
  };

  const activeItems = wishlist.filter(i => !i.bought);
  const boughtItems = wishlist.filter(i => i.bought);

  const currencyTotals = activeItems.reduce((acc, i) => {
    const c = i.currency || 'TND';
    const p = Number(i.price) || 0;
    if (p) acc[c] = (acc[c] || 0) + p;
    return acc;
  }, {});

  return (
    <>
      <style>{`
        .wl-card { transition: transform 0.2s, box-shadow 0.2s; }
        .wl-card:hover { transform: translateY(-2px); }
        .wl-overlay { animation: wlFadeIn 0.15s ease; }
        .wl-modal { animation: wlSlideUp 0.2s ease; }
        @keyframes wlFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wlSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '0 8px 60px' : '0 0 60px' }}>

        {/* ══ Header ══ */}
        <div className="glass-card" style={{
          padding: isMobile ? '16px 16px' : '22px 24px',
          marginBottom: isMobile ? '16px' : '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '12px',
          borderLeft: '3px solid var(--accent-amber)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: isMobile ? '40px' : '50px', height: isMobile ? '40px' : '50px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-amber)', flexShrink: 0,
            }}>
              <ShoppingBag size={isMobile ? 18 : 22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: isMobile ? '1.15rem' : '1.35rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                Wishlist
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {loading ? 'Loading\u2026' : (
                  activeItems.length === 0 ? '0 active items' : (
                    `${activeItems.length} active item${activeItems.length !== 1 ? 's' : ''}` +
                    (Object.keys(currencyTotals).length > 0 ? ' \u00b7 ' + Object.entries(currencyTotals)
                      .map(([code, sum]) => formatPrice(sum, code)).join(' + ') : '')
                  )
                )}
              </span>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="btn"
            style={{
              padding: isMobile ? '10px 18px' : '9px 18px',
              background: 'var(--accent-amber)', color: '#000', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px',
              fontSize: '0.88rem', minHeight: isMobile ? '44px' : 'auto',
            }}
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        {/* ══ Content ══ */}
        {loading ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--accent-amber)', borderRadius: '50%', animation: 'evolvia-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Loading wishlist\u2026
          </div>
        ) : wishlist.length === 0 ? (
          <div className="glass-card" style={{ padding: isMobile ? '50px 16px' : '70px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShoppingBag size={isMobile ? 36 : 48} style={{ opacity: 0.18, marginBottom: '16px', display: 'inline-block' }} />
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-secondary)' }}>Your wishlist is empty</p>
            <p style={{ margin: '0 0 20px', fontSize: '0.88rem' }}>Add your first item above!</p>
            <button
              onClick={openAdd}
              className="btn"
              style={{
                padding: isMobile ? '12px 24px' : '10px 22px', background: 'var(--accent-amber)', color: '#000',
                fontWeight: 700, borderRadius: '8px', display: 'inline-flex',
                alignItems: 'center', gap: '6px', fontSize: isMobile ? '0.95rem' : '0.88rem',
                minHeight: isMobile ? '44px' : 'auto',
              }}
            >
              <Plus size={isMobile ? 18 : 16} /> Add Item
            </button>
          </div>
        ) : (
          <>
            {/* ══ Tabs ══ */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: isMobile ? '12px' : '16px' }}>
              {['active', 'bought', 'all'].map(tab => (
                <button key={tab}
                  onClick={() => setBoughtFilter(tab)}
                  className="btn"
                  style={{
                    padding: isMobile ? '8px 16px' : '7px 14px',
                    fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px',
                    background: boughtFilter === tab ? 'var(--accent-amber)' : 'var(--dn-surface)',
                    color: boughtFilter === tab ? '#000' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    minHeight: isMobile ? '40px' : 'auto',
                    textTransform: 'capitalize',
                  }}>
                  {tab === 'bought' && <ShoppingCart size={13} />}
                  {tab === 'active' && <ShoppingBag size={13} />}
                  {tab === 'all' && <Gift size={13} />}
                  {tab}
                  {tab === 'active' && activeItems.length > 0 && (
                    <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>
                      {activeItems.length}
                    </span>
                  )}
                  {tab === 'bought' && boughtItems.length > 0 && (
                    <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '10px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>
                      {boughtItems.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filter items based on tab */}
            {(() => {
              let itemsToShow = wishlist;
              if (boughtFilter === 'active') itemsToShow = activeItems;
              else if (boughtFilter === 'bought') itemsToShow = boughtItems;

              if (itemsToShow.length === 0) {
                return (
                  <div className="glass-card" style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                      {boughtFilter === 'bought' ? 'No items bought yet' : boughtFilter === 'active' ? 'No active items' : 'No items'}
                    </p>
                  </div>
                );
              }

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: isMobile ? '12px' : '16px',
                }}>
                  {itemsToShow.map(item => {
                    const hasPrice = item.price != null && item.price !== '';
                    const hasUrl = item.url && item.url.trim();
                    const hasPhoto = item.photoUrl && item.photoUrl.trim();
                    const isBought = item.bought;
                    return (
                      <div key={item._id} className="glass-card wl-card" style={{
                        overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column',
                        border: deleteConfirmId === item._id ? '1.5px solid rgba(239,68,68,0.4)' : isBought ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                        opacity: isBought ? 0.8 : 1,
                      }}>
                        {/* Photo */}
                        <div style={{
                          width: '100%', height: isMobile ? '180px' : '200px',
                          background: 'var(--dn-surface)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', position: 'relative',
                        }}>
                          {hasPhoto ? (
                            <img src={item.photoUrl} alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div style={{
                            display: hasPhoto ? 'none' : 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            width: '100%', height: '100%',
                            color: 'var(--text-muted)', opacity: 0.2,
                          }}>
                            <ImageOff size={40} />
                          </div>

                          {/* Bought badge */}
                          {isBought && (
                            <div style={{
                              position: 'absolute', top: '10px', right: '10px',
                              background: 'rgba(16,185,129,0.9)', borderRadius: '8px',
                              padding: '4px 10px', color: '#fff', fontSize: '0.72rem',
                              fontWeight: 700, display: 'flex', alignItems: 'center',
                              gap: '4px', backdropFilter: 'blur(4px)',
                            }}>
                              <CheckCircle2 size={12} /> Bought
                            </div>
                          )}

                          {/* Delete overlay */}
                          {deleteConfirmId === item._id && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: 'rgba(0,0,0,0.6)',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', gap: '10px',
                              animation: 'wlFadeIn 0.15s ease',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>
                                <AlertTriangle size={16} /> Delete this item?
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}
                                  style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                                  Cancel
                                </button>
                                <button className="btn" onClick={() => executeDelete(item)}
                                  style={{ padding: '6px 14px', fontSize: '0.8rem', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ padding: isMobile ? '14px' : '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {item.name}
                            </h3>
                            {!isBought && (
                              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                <button
                                  onClick={() => openEdit(item)}
                                  className="dn-action-btn"
                                  style={{ width: isMobile ? '44px' : 'auto', height: isMobile ? '44px' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '4px 6px' }}
                                  title="Edit"
                                >
                                  <Pencil size={isMobile ? 16 : 13} />
                                </button>
                                <button
                                  onClick={() => confirmDelete(item)}
                                  className="dn-action-btn dn-action-btn-danger"
                                  style={{ width: isMobile ? '44px' : 'auto', height: isMobile ? '44px' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0' : '4px 6px' }}
                                  title="Delete"
                                >
                                  <Trash2 size={isMobile ? 16 : 13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {hasPrice && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, fontSize: '1.2rem', color: isBought ? 'var(--text-muted)' : 'var(--accent-emerald)' }}>
                              {formatPrice(item.price, item.currency || 'TND')}
                              {isBought && item.actualPrice != null && (
                                <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                                  (paid {formatPrice(item.actualPrice, item.currency || 'TND')})
                                </span>
                              )}
                            </div>
                          )}

                          {isBought && item.paidAt && (
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                              Bought on {formatDate(item.paidAt)}
                            </div>
                          )}

                          {hasUrl && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn"
                              style={{
                                marginTop: 'auto', padding: isMobile ? '10px' : '8px 12px',
                                fontSize: '0.8rem', background: 'var(--dn-surface)', color: 'var(--accent-amber)',
                                borderRadius: '8px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '6px', fontWeight: 600,
                                textDecoration: 'none', minHeight: isMobile ? '44px' : 'auto',
                              }}
                            >
                              <ExternalLink size={13} />
                              View Item
                              <LinkIcon size={11} style={{ opacity: 0.5 }} />
                            </a>
                          )}

                          {/* Buy button */}
                          {!isBought && (
                            <button
                              onClick={() => openBuy(item)}
                              className="btn"
                              style={{
                                marginTop: 'auto', padding: isMobile ? '10px' : '8px 12px',
                                fontSize: '0.8rem', background: 'rgba(16,185,129,0.15)', color: '#10b981',
                                borderRadius: '8px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: '6px', fontWeight: 700,
                                border: '1px solid rgba(16,185,129,0.25)',
                                minHeight: isMobile ? '44px' : 'auto',
                              }}
                            >
                              <ShoppingCart size={13} />
                              Buy
                            </button>
                          )}
                        </div>

                        {/* Date footer */}
                        <div style={{
                          padding: isMobile ? '10px 16px' : '8px 16px', borderTop: '1px solid var(--border)',
                          fontSize: isMobile ? '0.75rem' : '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace',
                        }}>
                          Added {formatDate(item.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* ══ Buy Modal ══ */}
        {buyItem && (
          <div className="wl-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? '12px' : '20px',
          }}
            onClick={(e) => { if (e.target === e.currentTarget && !buying) setBuyItem(null); }}
          >
            <div className="wl-modal" style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              width: '100%', maxWidth: '440px',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                padding: isMobile ? '16px' : '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingCart size={18} style={{ color: '#10b981' }} />
                  Buy Item
                </h3>
                <button onClick={() => setBuyItem(null)} disabled={buying}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Confirm purchase of <strong>{buyItem.name}</strong>
                  {buyItem.price != null && ` (listed at ${formatPrice(buyItem.price, buyItem.currency || 'TND')})`}
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Actual Price Paid (TND) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value)}
                    placeholder="0.000"
                    autoFocus
                    style={{
                      width: '100%', padding: isMobile ? '12px 14px' : '10px 14px',
                      fontSize: isMobile ? '16px' : '0.9rem', borderRadius: '8px',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {buyError && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
                    {buyError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setBuyItem(null)} disabled={buying}
                    style={{ padding: isMobile ? '12px 20px' : '9px 18px', fontSize: '0.88rem', minHeight: isMobile ? '44px' : 'auto' }}>
                    Cancel
                  </button>
                  <button onClick={handleBuy} className="btn" disabled={buying || !buyPrice || parseFloat(buyPrice) <= 0}
                    style={{
                      padding: isMobile ? '12px 20px' : '9px 18px', fontSize: '0.88rem', fontWeight: 700,
                      background: (buying || !buyPrice || parseFloat(buyPrice) <= 0) ? 'var(--dn-disabled-bg)' : '#10b981',
                      color: (buying || !buyPrice || parseFloat(buyPrice) <= 0) ? 'var(--text-muted)' : '#fff',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      minHeight: isMobile ? '44px' : 'auto',
                    }}>
                    {buying ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : <ShoppingCart size={16} />}
                    {buying ? 'Buying\u2026' : 'Confirm Purchase'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Add/Edit Modal ══ */}
        {showModal && (
          <div className="wl-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? '12px' : '20px',
          }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <div className="wl-modal" style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              width: '100%', maxWidth: '520px',
              maxHeight: '90vh', overflowY: 'auto',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                padding: isMobile ? '16px' : '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} style={{ color: 'var(--accent-amber)' }} />
                  {editItem ? 'Edit Item' : 'Add Item'}
                </h3>
                <button onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Item Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="What do you want?"
                    required
                    autoFocus
                    style={{
                      width: '100%', padding: isMobile ? '12px 14px' : '10px 14px',
                      fontSize: isMobile ? '16px' : '0.9rem', borderRadius: '8px',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Price <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.82rem', fontWeight: 600,
                    }}>
                      DT
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.000"
                      style={{
                        width: '100%', padding: isMobile ? '12px 14px 12px 36px' : '10px 14px 10px 36px',
                        fontSize: isMobile ? '16px' : '0.9rem', borderRadius: '8px',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Currency
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1, fontSize: '0.82rem', fontWeight: 600,
                    }}>
                      DT
                    </span>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      style={{
                        width: '100%', padding: isMobile ? '12px 14px 12px 36px' : '10px 14px 10px 36px',
                        fontSize: isMobile ? '16px' : '0.9rem', borderRadius: '8px',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', boxSizing: 'border-box',
                        appearance: 'none', cursor: 'pointer',
                      }}
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={15} style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', pointerEvents: 'none',
                    }} />
                  </div>
                </div>

                {/* URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Website URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <LinkIcon size={15} style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', pointerEvents: 'none',
                    }} />
                    <input
                      type="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://example.com/product"
                      style={{
                        width: '100%', padding: isMobile ? '12px 14px 12px 34px' : '10px 14px 10px 34px',
                        fontSize: isMobile ? '16px' : '0.9rem', borderRadius: '8px',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Photo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional, JPEG/PNG)</span>
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${photoPreview ? 'var(--accent-amber)' : 'var(--border)'}`,
                      borderRadius: '10px', padding: isMobile ? '20px' : '24px',
                      textAlign: 'center', cursor: 'pointer',
                      transition: 'border-color 0.2s',
                      background: photoPreview ? 'rgba(249,115,22,0.04)' : 'transparent',
                    }}
                  >
                    {photoPreview ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={photoPreview} alt="Preview"
                          style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }}
                        />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoFile(null); setPhotoPreview(''); }}
                          style={{
                            position: 'absolute', top: '-8px', right: '-8px',
                            background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                            borderRadius: '50%', width: '24px', height: '24px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>
                        <Gift size={32} style={{ opacity: 0.3, marginBottom: '8px', display: 'inline-block' }} />
                        <p style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 600 }}>Click to upload a photo</p>
                        <p style={{ margin: 0, fontSize: '0.78rem' }}>JPEG or PNG, up to 5MB</p>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', padding: '6px 0' }}>
                    {error}
                  </div>
                )}
                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}
                    style={{ padding: isMobile ? '12px 20px' : '9px 18px', fontSize: '0.88rem', minHeight: isMobile ? '44px' : 'auto' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={!name.trim() || saving}
                    style={{
                      padding: isMobile ? '12px 20px' : '9px 18px', fontSize: '0.88rem', fontWeight: 700,
                      background: name.trim() ? 'var(--accent-amber)' : 'var(--dn-disabled-bg)',
                      color: name.trim() ? '#000' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      minHeight: isMobile ? '44px' : 'auto',
                    }}>
                    {saving ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000' }} /> : <Plus size={16} />}
                    {editItem ? 'Save Changes' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}