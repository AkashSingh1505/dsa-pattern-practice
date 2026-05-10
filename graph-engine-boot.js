/**
 * graph.html — wire Load live / Import / Export (requires script.js + graph engine DOM).
 */
(function () {
    function engineMount() {
        return (
            window.DSA_GRAPH_ENGINE_MOUNT || {
                viewportId: "graph-dsa-hierarchy-root",
                mapToolbarHostId: "graph-dsa-map-toolbar-host",
                shellToolbarId: "graph-dsa-shell-view-toolbar",
            }
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        var loadBtn = document.getElementById("graph-load-live");
        var exportBtn = document.getElementById("graph-export-json");
        var importBtn = document.getElementById("graph-import-json");
        var fileInput = document.getElementById("graph-json-file");
        var tourBtn = document.getElementById("graph-tour-start");
        var resetTourBtn = document.getElementById("graph-tour-reset");

        if (loadBtn) {
            loadBtn.addEventListener("click", async function () {
                if (typeof dsaLoadHierarchyFromSources !== "function" || typeof loadDsaPatternsPage !== "function") {
                    return;
                }
                loadBtn.disabled = true;
                try {
                    await dsaLoadHierarchyFromSources();
                    if (typeof dsaInitUserData === "function") {
                        await dsaInitUserData();
                    }
                    loadDsaPatternsPage({ graphPreview: false, mount: engineMount() });
                } catch (e) {
                    console.warn(e);
                } finally {
                    loadBtn.disabled = false;
                }
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener("click", function () {
                if (typeof dsaExportMindMapHierarchyJson === "function") {
                    dsaExportMindMapHierarchyJson();
                }
            });
        }

        if (importBtn && fileInput) {
            importBtn.addEventListener("click", function () {
                fileInput.click();
            });
            fileInput.addEventListener("change", function () {
                var file = fileInput.files && fileInput.files[0];
                if (!file) {
                    return;
                }
                var reader = new FileReader();
                reader.onload = function () {
                    var text = String(reader.result || "");
                    if (typeof dsaApplyMindMapHierarchyJson !== "function") {
                        return;
                    }
                    var r = dsaApplyMindMapHierarchyJson(text, {
                        graphPreview: false,
                        mount: engineMount(),
                    });
                    if (!r.ok) {
                        window.alert((r.error && r.error.message) || "Invalid JSON");
                    }
                    fileInput.value = "";
                };
                reader.readAsText(file);
            });
        }

        if (tourBtn && typeof window.dsaGraphEngineOpenTour === "function") {
            tourBtn.addEventListener("click", function () {
                window.dsaGraphEngineOpenTour({ force: true });
            });
        }

        if (resetTourBtn && typeof window.dsaGraphEngineResetTour === "function") {
            resetTourBtn.addEventListener("click", function () {
                window.dsaGraphEngineResetTour();
                window.alert("Tour reset. Reload the page or click “Start tour” to see it again.");
            });
        }
    });
})();
