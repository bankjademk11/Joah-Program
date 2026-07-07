import { createContext, useContext, useState, useCallback } from 'react';

const LowStockContext = createContext(null);

export function LowStockProvider({ children }) {
    const [lowStockItems, setLowStockItems] = useState([]);

    const updateLowStock = useCallback((allItems) => {
        if (!Array.isArray(allItems)) return;

        const alerts = allItems
            .filter(item => {
                const qty = Number(item.qty ?? item.quantity ?? 0);
                const maxQty = Number(item.maxQty ?? item.max_qty ?? 0);
                if (maxQty <= 0) return false; // No Max Qty set = skip
                const ratio = qty / maxQty;
                return ratio <= 0.3; // 30% or below triggers alert
            })
            .map(item => {
                const qty = Number(item.qty ?? item.quantity ?? 0);
                const maxQty = Number(item.maxQty ?? item.max_qty ?? 0);
                const ratio = qty / maxQty;
                return {
                    id: item.id || item.barcode,
                    barcode: item.barcode || item.barcode_no || '-',
                    name: item.itemName || item.masterItemName || item.productName || item.product_name_la || item.name || 'ບໍ່ມີຊື່',
                    qty,
                    maxQty,
                    ratio,
                    rackLocation: item.rackLocation || item.rack_location || '-',
                    severity: ratio <= 0 ? 'empty' : ratio <= 0.1 ? 'critical' : 'warning',
                };
            })
            .sort((a, b) => a.ratio - b.ratio); // Most critical first

        setLowStockItems(alerts);
    }, []);

    return (
        <LowStockContext.Provider value={{ lowStockItems, updateLowStock }}>
            {children}
        </LowStockContext.Provider>
    );
}

export function useLowStock() {
    const ctx = useContext(LowStockContext);
    if (!ctx) throw new Error('useLowStock must be used within LowStockProvider');
    return ctx;
}
