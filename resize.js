/* =====================================================
   ExactKB.in - Image Resize & Compress (client side)
   Fast approach: binary-search JPEG quality, and only
   shrink dimensions when quality alone cannot reach the
   target size.
   ===================================================== */
(function () {
    "use strict";

    var $ = function (id) { return document.getElementById(id); };

    var els = {
        input: $("imageInput"),
        dropzone: $("dropzone"),
        previewBox: $("previewBox"),
        preview: $("previewImage"),
        fileName: $("fileName"),
        fileMeta: $("fileMeta"),
        target: $("targetSize"),
        presets: document.querySelectorAll(".preset-btn"),
        resizeBtn: $("resizeBtn"),
        processing: $("processing"),
        processingText: $("processingText"),
        error: $("errorMsg"),
        card: $("resultCard"),
        resultTitle: $("resultTitle"),
        before: $("sizeBefore"),
        after: $("sizeAfter"),
        meta: $("resultMeta"),
        download: $("downloadLink"),
        feedbackForm: $("feedbackForm"),
        fbStatus: $("fbStatus")
    };

    var MIN_QUALITY = 0.4;   // below this, JPEG looks bad - shrink dimensions instead
    var MAX_SIDE = 4000;     // pre-shrink huge photos so encoding stays fast
    var MIN_SIDE = 120;      // never shrink smaller than this
    var SEARCH_STEPS = 6;

    var state = { img: null, file: null, srcUrl: null, outUrl: null, busy: false };

    /* ---------- helpers ---------- */
    function fmtKB(bytes) { return (bytes / 1024).toFixed(1) + " KB"; }

    function showError(msg) {
        els.error.textContent = msg || "";
        els.error.hidden = !msg;
    }

    function setBusy(busy, text) {
        state.busy = busy;
        els.resizeBtn.disabled = busy || !state.img;
        els.processing.hidden = !busy;
        if (text) els.processingText.textContent = text;
    }

    function clearResult() {
        els.card.hidden = true;
        if (state.outUrl) {
            URL.revokeObjectURL(state.outUrl);
            state.outUrl = null;
        }
    }

    function nextFrame() {
        return new Promise(function (resolve) { setTimeout(resolve, 20); });
    }

    /* ---------- presets ---------- */
    function syncPresets() {
        var v = String(parseInt(els.target.value, 10));
        els.presets.forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-size") === v);
        });
    }

    els.presets.forEach(function (btn) {
        btn.addEventListener("click", function () {
            els.target.value = btn.getAttribute("data-size");
            syncPresets();
            showError("");
        });
    });
    els.target.addEventListener("input", syncPresets);
    els.target.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !els.resizeBtn.disabled) run();
    });
    syncPresets();

    /* ---------- loading a file ---------- */
    function loadFile(file) {
        if (!file) return;
        showError("");
        clearResult();

        if (!/^image\//.test(file.type)) {
            showError("That doesn't look like an image. Please choose a JPG, PNG or WebP file.");
            return;
        }

        var url = URL.createObjectURL(file);
        var img = new Image();

        img.onload = function () {
            if (state.srcUrl) URL.revokeObjectURL(state.srcUrl);
            state.img = img;
            state.file = file;
            state.srcUrl = url;

            els.preview.src = url;
            els.previewBox.hidden = false;
            els.fileName.textContent = file.name;
            els.fileMeta.textContent = img.naturalWidth + " × " + img.naturalHeight + " px · " + fmtKB(file.size);
            els.resizeBtn.disabled = false;
        };

        img.onerror = function () {
            URL.revokeObjectURL(url);
            showError("Couldn't read that image. HEIC/HEIF photos aren't supported by browsers - please use a JPG or PNG.");
        };

        img.src = url;
    }

    els.input.addEventListener("change", function () {
        loadFile(els.input.files[0]);
        els.input.value = ""; // allow picking the same file again
    });

    ["dragenter", "dragover"].forEach(function (ev) {
        els.dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            els.dropzone.classList.add("drag");
        });
    });
    ["dragleave", "drop"].forEach(function (ev) {
        els.dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            els.dropzone.classList.remove("drag");
        });
    });
    els.dropzone.addEventListener("drop", function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) loadFile(files[0]);
    });

    /* ---------- compression ---------- */
    function draw(img, w, h) {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";          // avoid black background for transparent PNGs
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return canvas;
    }

    function encode(canvas, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                blob ? resolve(blob) : reject(new Error("Encoding failed"));
            }, "image/jpeg", quality);
        });
    }

    // Find the highest quality whose size is still <= target.
    async function fitQuality(canvas, targetBytes) {
        var lo = MIN_QUALITY, hi = 1;
        var lowBlob = await encode(canvas, lo);
        if (lowBlob.size > targetBytes) return { blob: lowBlob, ok: false };

        var best = lowBlob;
        for (var i = 0; i < SEARCH_STEPS; i++) {
            var mid = (lo + hi) / 2;
            var b = await encode(canvas, mid);
            if (b.size <= targetBytes) { best = b; lo = mid; } else { hi = mid; }
        }
        return { blob: best, ok: true };
    }

    async function run() {
        if (state.busy || !state.img) return;
        showError("");
        clearResult();

        var targetKB = parseInt(els.target.value, 10);
        if (!(targetKB >= 5 && targetKB <= 5000)) {
            showError("Please enter a target size between 5 and 5000 KB.");
            els.target.focus();
            return;
        }

        setBusy(true, "Compressing…");
        await nextFrame(); // let the loader paint first

        try {
            var targetBytes = targetKB * 1024;
            var img = state.img;
            var w = img.naturalWidth, h = img.naturalHeight;

            var pre = Math.min(1, MAX_SIDE / Math.max(w, h));
            w = Math.max(1, Math.round(w * pre));
            h = Math.max(1, Math.round(h * pre));

            var result = null;
            for (var round = 0; round < 8; round++) {
                var canvas = draw(img, w, h);
                var r = await fitQuality(canvas, targetBytes);
                result = { blob: r.blob, ok: r.ok, w: w, h: h };
                if (r.ok) break;

                var factor = Math.sqrt(targetBytes / r.blob.size) * 0.95;
                var nw = Math.round(w * factor), nh = Math.round(h * factor);
                if (Math.min(nw, nh) < MIN_SIDE) break;
                w = nw; h = nh;
                els.processingText.textContent = "Reducing dimensions…";
                await nextFrame();
            }

            showResult(result, targetKB);
        } catch (err) {
            showError("Something went wrong while processing. Please try another image.");
        } finally {
            setBusy(false);
        }
    }

    function showResult(result, targetKB) {
        var base = (state.file.name || "image").replace(/\.[^.]+$/, "");
        state.outUrl = URL.createObjectURL(result.blob);

        els.download.href = state.outUrl;
        els.download.download = base + "_" + targetKB + "kb.jpg";

        els.before.textContent = fmtKB(state.file.size);
        els.after.textContent = fmtKB(result.blob.size);
        els.meta.textContent = result.w + " × " + result.h + " px · JPG";

        els.card.classList.toggle("warn", !result.ok);
        els.resultTitle.textContent = result.ok
            ? "✅ Done! Under " + targetKB + " KB"
            : "⚠️ Closest possible - couldn't reach " + targetKB + " KB without making the image too small";

        els.card.hidden = false;
        els.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        els.download.focus({ preventScroll: true });
    }

    els.resizeBtn.addEventListener("click", run);

    /* ---------- feedback ---------- */
    els.feedbackForm.addEventListener("submit", function (e) {
        e.preventDefault();

        var name = $("fbName").value.trim();
        var message = $("fbMessage").value.trim();
        if (!message) return;

        var body = "Name: " + (name || "Anonymous") + "\n\nFeedback:\n" + message;
        window.location.href = "mailto:exactkb.pravik@gmail.com?subject=" +
            encodeURIComponent("ExactKB Feedback") + "&body=" + encodeURIComponent(body);

        els.fbStatus.textContent = "Opening your email app… if nothing opens, write to exactkb.pravik@gmail.com";
        els.feedbackForm.reset();
    });
})();
