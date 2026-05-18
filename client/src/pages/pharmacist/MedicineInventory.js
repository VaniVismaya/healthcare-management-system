import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { pharmacistAPI } from '../../utils/api';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const ADD_MEDICINE_DRAFT_KEY = 'pharmacy_add_medicine_draft';
const UPDATE_STOCK_DRAFT_KEY = 'pharmacy_update_stock_draft';

export default function MedicineInventory() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState({
    name: '', generic_name: '', brand_name: '', manufacturer: '', category: '',
    dosage_form: 'tablet', strength: '', unit: '', price: '', mrp: '', requires_prescription: true,
  });
  const [stockForm, setStockForm] = useState({
    medicine_id: '', quantity: '', movement_type: 'in', batch_number: '', expiry_date: '', purchase_price: '', low_stock_alert: ''
  });

  const load = () => {
    setLoading(true);
    pharmacistAPI.getMedicines()
      .then(({ data }) => setMedicines(data.medicines || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const addDraft = loadDraft(ADD_MEDICINE_DRAFT_KEY);
    const stockDraft = loadDraft(UPDATE_STOCK_DRAFT_KEY);
    if (addDraft) setAddForm((prev) => ({ ...prev, ...addDraft }));
    if (stockDraft) setStockForm((prev) => ({ ...prev, ...stockDraft }));
  }, []);
  useEffect(() => {
    saveDraft(ADD_MEDICINE_DRAFT_KEY, addForm);
  }, [addForm]);
  useEffect(() => {
    saveDraft(UPDATE_STOCK_DRAFT_KEY, stockForm);
  }, [stockForm]);

  const addMedicine = async () => {
    if (!addForm.name || !addForm.price) return toast.error('Name and price are required');
    try {
      await pharmacistAPI.addMedicine({
        ...addForm,
        price: Number(addForm.price),
        mrp: addForm.mrp ? Number(addForm.mrp) : null,
        requires_prescription: !!addForm.requires_prescription,
      });
      toast.success('Medicine added');
      clearDraft(ADD_MEDICINE_DRAFT_KEY);
      setAddForm({
        name: '', generic_name: '', brand_name: '', manufacturer: '', category: '',
        dosage_form: 'tablet', strength: '', unit: '', price: '', mrp: '', requires_prescription: true,
      });
      load();
    } catch {
      toast.error('Failed to add medicine');
    }
  };

  const updateStock = async () => {
    if (!stockForm.medicine_id || !stockForm.quantity) return toast.error('Select medicine and quantity');
    try {
      await pharmacistAPI.updateStock({
        ...stockForm,
        medicine_id: Number(stockForm.medicine_id),
        quantity: Number(stockForm.quantity),
        purchase_price: stockForm.purchase_price ? Number(stockForm.purchase_price) : null,
        low_stock_alert: stockForm.low_stock_alert ? Number(stockForm.low_stock_alert) : undefined,
      });
      toast.success('Stock updated');
      clearDraft(UPDATE_STOCK_DRAFT_KEY);
      setStockForm({ medicine_id: '', quantity: '', movement_type: 'in', batch_number: '', expiry_date: '', purchase_price: '', low_stock_alert: '' });
      load();
    } catch {
      toast.error('Failed to update stock');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Add Medicine</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Medicine details are saved locally on this device while you work offline and will be ready when internet returns.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Medicine Name<span className="required">*</span></label>
              <input className="form-input" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Name</label>
              <input className="form-input" value={addForm.brand_name} onChange={(e) => setAddForm({ ...addForm, brand_name: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Strength</label>
              <input className="form-input" value={addForm.strength} onChange={(e) => setAddForm({ ...addForm, strength: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input className="form-input" value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Price<span className="required">*</span></label>
              <input className="form-input" type="number" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">MRP</label>
              <input className="form-input" type="number" value={addForm.mrp} onChange={(e) => setAddForm({ ...addForm, mrp: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={addMedicine}>Add</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Update Stock</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Stock update details are also saved locally on this device while you work offline.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Medicine</label>
              <select className="form-select" value={stockForm.medicine_id} onChange={(e) => setStockForm({ ...stockForm, medicine_id: e.target.value })}>
                <option value="">Select Medicine</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} {m.strength || ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Movement</label>
              <select className="form-select" value={stockForm.movement_type} onChange={(e) => setStockForm({ ...stockForm, movement_type: e.target.value })}>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Batch Number</label>
              <input className="form-input" value={stockForm.batch_number} onChange={(e) => setStockForm({ ...stockForm, batch_number: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input className="form-input" type="date" value={stockForm.expiry_date} onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase Price</label>
              <input className="form-input" type="number" value={stockForm.purchase_price} onChange={(e) => setStockForm({ ...stockForm, purchase_price: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-outline" onClick={updateStock}>Update Stock</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Inventory</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : medicines.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No medicines yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Strength</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.strength || '-'}</td>
                      <td>{m.price}</td>
                      <td>{m.stock_quantity ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
