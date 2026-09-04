(function(){
    if (document.getElementById('jarvis-odoo-bot')) {
        document.getElementById('jarvis-odoo-bot').remove();
    }

    var panel = document.createElement('div');
    panel.id = 'jarvis-odoo-bot';
    panel.style.cssText = 'position:fixed;top:20px;right:20px;width:390px;background:#090d16;color:#fff;border:2px solid #00f2ff;border-radius:18px;box-shadow:0 0 40px rgba(0,242,255,0.25), 0 25px 60px rgba(0,0,0,0.9);z-index:9999999;font-family:system-ui,-apple-system,sans-serif;padding:18px;font-size:12px;';
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(0,242,255,0.2);padding-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#00f2ff;box-shadow:0 0 10px #00f2ff;"></span>
                <b style="color:#00f2ff;font-size:15px;letter-spacing:1px;font-weight:900;">JARVIS — 2S DELAY LOCK</b>
            </div>
            <button id="j-close" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid #ef4444;border-radius:8px;padding:3px 9px;cursor:pointer;font-weight:bold;font-size:11px;">✕</button>
        </div>
        <div style="margin-bottom:8px;">
            <label style="color:#94a3b8;font-size:11px;font-weight:600;display:block;margin-bottom:4px;">📁 Import Barcodes (.txt / .md):</label>
            <input type="file" id="j-file" accept=".txt,.md" style="width:100%;font-size:11px;background:#131b2e;padding:6px;border-radius:8px;border:1px solid #1e293b;color:#fff;box-sizing:border-box;"/>
        </div>
        <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <label style="color:#94a3b8;font-size:11px;font-weight:600;">📋 Barcode Queue:</label>
                <span style="color:#00f2ff;font-weight:bold;font-size:11px;"><span id="j-cnt">0</span> items</span>
            </div>
            <textarea id="j-txt" placeholder="Paste barcodes here or choose file above..." style="width:100%;height:70px;background:#131b2e;border:1px solid #1e293b;color:#38bdf8;padding:8px;border-radius:8px;font-family:monospace;font-size:11px;box-sizing:border-box;resize:none;line-height:1.4;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
                <label style="color:#94a3b8;font-size:10px;font-weight:600;display:block;margin-bottom:2px;">Location Adjust:</label>
                <input type="text" id="j-loc" value="A0000001" style="width:100%;background:#131b2e;border:1px solid #1e293b;color:#00f2ff;padding:6px;border-radius:6px;font-weight:bold;box-sizing:border-box;"/>
            </div>
            <div>
                <label style="color:#94a3b8;font-size:10px;font-weight:600;display:block;margin-bottom:2px;">Reason Code:</label>
                <input type="text" id="j-rsn" value="AJ003" style="width:100%;background:#131b2e;border:1px solid #1e293b;color:#00f2ff;padding:6px;border-radius:6px;font-weight:bold;box-sizing:border-box;"/>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
                <label style="color:#94a3b8;font-size:10px;font-weight:600;display:block;margin-bottom:2px;">Batch (Rows):</label>
                <input type="number" id="j-max" value="20" style="width:100%;background:#131b2e;border:1px solid #1e293b;color:#facc15;padding:6px;border-radius:6px;font-weight:bold;box-sizing:border-box;"/>
            </div>
            <div>
                <label style="color:#94a3b8;font-size:10px;font-weight:600;display:block;margin-bottom:2px;">Delay Mode:</label>
                <div style="background:#131b2e;border:1px solid #1e293b;color:#4ade80;padding:6px;border-radius:6px;font-weight:bold;font-size:10px;display:flex;align-items:center;gap:4px;">
                    <span>⏳ 2.0s Safe Pause</span>
                </div>
            </div>
        </div>
        <div id="j-pbox" style="margin-bottom:12px;display:none;">
            <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:10px;margin-bottom:4px;">
                <span id="j-status" style="color:#e2e8f0;font-weight:600;">Processing...</span>
                <span id="j-pct" style="color:#00f2ff;font-weight:bold;">0%</span>
            </div>
            <div style="width:100%;height:5px;background:#1e293b;border-radius:3px;overflow:hidden;">
                <div id="j-pbar" style="width:0%;height:100%;background:linear-gradient(90deg, #00f2ff, #38bdf8);box-shadow:0 0 10px #00f2ff;"></div>
            </div>
        </div>
        <div style="display:flex;gap:8px;">
            <button id="j-start" style="flex:1;background:linear-gradient(135deg, #00f2ff, #0284c7);color:#090d16;border:none;padding:10px;border-radius:8px;font-weight:900;letter-spacing:0.5px;cursor:pointer;box-shadow:0 4px 15px rgba(0,242,255,0.3);">⚡ START JARVIS</button>
            <button id="j-stop" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid #ef4444;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer;display:none;">⏹ STOP</button>
        </div>
    `;
    document.body.appendChild(panel);

    var isRunning = false;
    document.getElementById('j-close').onclick = function() { panel.remove(); };

    var fileInput = document.getElementById('j-file');
    var textArea = document.getElementById('j-txt');
    var countSpan = document.getElementById('j-cnt');

    var updateCount = function() {
        var lines = textArea.value.split('\n').map(function(x) { return x.trim(); }).filter(function(x) { return x.length > 0; });
        countSpan.innerText = lines.length;
    };

    fileInput.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            textArea.value = ev.target.result;
            updateCount();
        };
        reader.readAsText(file);
    };

    textArea.oninput = updateCount;

    var wait = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

    var realClick = function(el) {
        if (!el) return;
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        if (el.focus) el.focus();
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.click();
    };

    var sendKey = function(el, key, code) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: key, keyCode: code, which: code, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keypress', { key: key, keyCode: code, which: code, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: key, keyCode: code, which: code, bubbles: true }));
    };

    // Type text and press Enter then wait — Bug Fix: only use td's own input, never document.activeElement
    var typeAndEnterField = async function(targetRow, fieldName, targetValue, statusEl, label) {
        var td = targetRow.querySelector('td[name="' + fieldName + '"], div[name="' + fieldName + '"]');
        if (!td) return false;

        realClick(td);
        await wait(500);

        // BUG FIX #1: Only use input found inside the specific td — never fall back to activeElement
        var inp = td.querySelector('input');
        if (!inp) return false;

        inp.focus();
        // BUG FIX #3: dispatch input event after clearing so Odoo knows the field was reset
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(100);

        inp.value = targetValue;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        await wait(400);

        // BUG FIX #4: sendKey now includes keypress event
        sendKey(inp, 'Enter', 13);
        
        if (statusEl) statusEl.innerText = `⏳ Entered ${label} (${targetValue}) -> Waiting 2s...`;
        
        // Explicit 2 seconds delay as requested
        await wait(2000);

        inp.blur();
        return true;
    };

    document.getElementById('j-start').onclick = async function() {
        var codes = textArea.value.split('\n').map(function(x) { return x.trim(); }).filter(function(x) { return x.length > 0; });
        if (codes.length === 0) {
            alert('⚠️ Please insert or import barcodes first!');
            return;
        }

        var maxRows = parseInt(document.getElementById('j-max').value) || 20;
        var locVal = document.getElementById('j-loc').value.trim();
        var reasonVal = document.getElementById('j-rsn').value.trim();

        var batch = codes.slice(0, maxRows);
        var remaining = codes.slice(maxRows);

        isRunning = true;
        document.getElementById('j-start').style.display = 'none';
        document.getElementById('j-stop').style.display = 'block';
        document.getElementById('j-pbox').style.display = 'block';

        var statusText = document.getElementById('j-status');
        var progressBar = document.getElementById('j-pbar');
        var percentText = document.getElementById('j-pct');

        for (var i = 0; i < batch.length; i++) {
            if (!isRunning) break;
            var code = batch[i];
            statusText.innerText = `[${i + 1}/${batch.length}] Injecting Barcode: ${code}...`;
            var pct = Math.round(((i + 1) / batch.length) * 100);
            progressBar.style.width = pct + '%';
            percentText.innerText = pct + '%';

            // 1. Release keyboard focus completely
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
            await wait(200);

            // 2. Click "Add a line" — BUG FIX #5: check button is not disabled before clicking
            var addLineBtns = Array.from(document.querySelectorAll('a, button')).filter(function(el) { 
                return el.textContent && el.textContent.trim() === 'Add a line' && !el.disabled && !el.classList.contains('disabled');
            });
            if (addLineBtns.length === 0) {
                alert('❌ "Add a line" button not found or is disabled!');
                break;
            }
            var prevRowCount = document.querySelectorAll('table tbody tr.o_data_row').length;
            realClick(addLineBtns[addLineBtns.length - 1]);
            // BUG FIX #2: Wait until a NEW row actually appears in the table (not just fixed 900ms)
            var waitStart = Date.now();
            while (document.querySelectorAll('table tbody tr.o_data_row').length <= prevRowCount && Date.now() - waitStart < 3000) {
                await wait(150);
            }
            await wait(300);

            // 3. Type Barcode into newly created row only
            // BUG FIX #2 continued: always pick the last row after count increased
            var allRows = document.querySelectorAll('table tbody tr.o_data_row');
            var targetRow = document.querySelector('tr.o_selected_row') || allRows[allRows.length - 1];
            if (targetRow) {
                var barcodeCell = targetRow.querySelector('td[name="product_barcode"], td[name="lot_id"], td:first-child + td');
                if (barcodeCell) {
                    realClick(barcodeCell);
                    await wait(250);
                }

                var barcodeInput = targetRow.querySelector('td[name="product_barcode"] input, td:first-child + td input') || targetRow.querySelector('input');
                if (barcodeInput) {
                    barcodeInput.focus();
                    barcodeInput.value = code;
                    barcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
                    barcodeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    sendKey(barcodeInput, 'Enter', 13);
                    
                    // Wait 2s for Product resolution
                    statusText.innerText = `[${i + 1}/${batch.length}] Barcode entered -> Waiting 2s for Product...`;
                    await wait(2000);

                    // 4. Type Location Adjust (A0000001) -> Enter -> Delay 2s
                    await typeAndEnterField(targetRow, 'location_adjust_id', locVal, statusText, 'Location');

                    // 5. Type Reason Code (AJ003) -> Enter -> Delay 2s
                    await typeAndEnterField(targetRow, 'reason_code_id', reasonVal, statusText, 'Reason');
                }
            }
            await wait(400);
        }

        textArea.value = remaining.join('\n');
        updateCount();
        isRunning = false;
        document.getElementById('j-start').style.display = 'block';
        document.getElementById('j-stop').style.display = 'none';
        statusText.innerText = `🎉 Batch Completed! Finished ${batch.length} lines.`;
    };

    document.getElementById('j-stop').onclick = function() {
        isRunning = false;
        document.getElementById('j-status').innerText = '⏹ Process paused by user';
    };
})();
