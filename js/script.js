document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const themeIcon = document.getElementById("themeIcon");
    const htmlElement = document.documentElement;

    const savedTheme = localStorage.getItem("faltuWebTheme");
    const currentTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    htmlElement.setAttribute("data-theme", currentTheme);
    updateThemeIcon(currentTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const theme = htmlElement.getAttribute("data-theme");
            const newTheme = theme === "dark" ? "light" : "dark";
            htmlElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("faltuWebTheme", newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (themeIcon) {
            themeIcon.className = theme === "dark" ? "icon-moon" : "icon-sun";
        }
    }

    const pleaseBtn = document.getElementById("pleaseButton");
    const sitePopupModal = document.getElementById("sitePopupModal");
    const popupContainerBox = document.getElementById("popupContainerBox");
    const popupSiteTitle = document.getElementById("popupSiteTitle");
    const popupIframe = document.getElementById("popupIframe");
    const popupRandomBtn = document.getElementById("popupRandomBtn");
    const popupNewTabBtn = document.getElementById("popupNewTabBtn");
    const popupFullscreenBtn = document.getElementById("popupFullscreenBtn");
    const popupCloseBtn = document.getElementById("popupCloseBtn");
    const pleaseClicksCountEl = document.getElementById("pleaseClicksCount");
    const popupVisitCountEl = document.getElementById("popupVisitCountEl");

    let currentWebsitesList = [];
    let activeSite = null;
    let visitInterval = null;
    let dbInstance = null;
    let firebaseModules = null;

    function getSiteSlug(site) {
        if (!site) return "";
        if (site.link) {
            return site.link.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
        return (site.title || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    async function getFirebaseDB() {
        if (dbInstance) return { db: dbInstance, mods: firebaseModules };
        
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const mods = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const firebaseConfig = {
            apiKey: "AIzaSyAGkcUYHaEJ7RU6kUtnCa_FSqNDTNxVHUM",
            authDomain: "faltu-web-xgp.firebaseapp.com",
            projectId: "faltu-web-xgp",
            storageBucket: "faltu-web-xgp.firebasestorage.app",
            messagingSenderId: "485580330649",
            appId: "1:485580330649:web:08f28d02433cd33be0ca08",
        };

        const app = initializeApp(firebaseConfig);
        dbInstance = mods.getFirestore(app);
        firebaseModules = mods;
        return { db: dbInstance, mods: firebaseModules };
    }

    async function loadInitialData() {
        try {
            const { db, mods } = await getFirebaseDB();
            const statsDocRef = mods.doc(db, "stats", "global");
            const statsSnap = await mods.getDoc(statsDocRef);
            if (statsSnap.exists()) {
                const statsData = statsSnap.data();
                const totalClicks = statsData.totalPleaseClicks || 0;

                if (pleaseClicksCountEl) pleaseClicksCountEl.textContent = totalClicks.toLocaleString();
                const footerTotalClicksEl = document.getElementById("footerTotalClicks");
                if (footerTotalClicksEl) footerTotalClicksEl.textContent = totalClicks.toLocaleString();
            }

            const querySnapshot = await mods.getDocs(mods.collection(db, "websites"));
            currentWebsitesList = [];
            let aggregatedViews = 0;

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                currentWebsitesList.push({ id: docSnap.id, ...data });

                const siteViews = Number(data.views || data.visits || 0);
                aggregatedViews += siteViews;
            });

            const footerTotalViewsEl = document.getElementById("footerTotalViews");
            if (footerTotalViewsEl) footerTotalViewsEl.textContent = aggregatedViews.toLocaleString();

            checkAndOpenFromUrl();
        } catch (err) {
            console.error("Error loading initial data:", err);
        }
    }

    window.setTimeout(() => {
        loadInitialData();
    }, 1000);

    function checkAndOpenFromUrl() {
        const hash = window.location.hash.replace('#', '').toLowerCase();
        if (hash && currentWebsitesList.length > 0) {
            const matchedSite = currentWebsitesList.find(site => getSiteSlug(site) === hash);
            if (matchedSite) {
                openPopupWithSite(matchedSite, false);
            }
        }
    }

    async function incrementPleaseClickCount() {
        try {
            const { db, mods } = await getFirebaseDB();
            const statsRef = mods.doc(db, "stats", "global");
            await mods.updateDoc(statsRef, { totalPleaseClicks: mods.increment(1) });

            const statsSnap = await mods.getDoc(statsRef);
            if (statsSnap.exists()) {
                const totalClicks = statsSnap.data().totalPleaseClicks || 0;
                if (pleaseClicksCountEl) pleaseClicksCountEl.textContent = totalClicks.toLocaleString();
                const footerTotalClicksEl = document.getElementById("footerTotalClicks");
                if (footerTotalClicksEl) footerTotalClicksEl.textContent = totalClicks.toLocaleString();
            }
        } catch (err) {
            console.error("Error incrementing please click count:", err);
        }
    }

    if (pleaseBtn) {
        pleaseBtn.addEventListener("click", async () => {
            incrementPleaseClickCount();

            if (currentWebsitesList.length === 0) {
                await loadInitialData();
            }
            if (currentWebsitesList.length > 0) {
                const randomIndex = Math.floor(Math.random() * currentWebsitesList.length);
                openPopupWithSite(currentWebsitesList[randomIndex], true);
            }
        });
    }

    async function openPopupWithSite(site, updateHistory = true) {
        activeSite = site;

        if (activeSite) {
            popupSiteTitle.textContent = activeSite.title || "FaltuWeb Site";
            const initialVisits = activeSite.views || activeSite.visits || 0;
            updateVisitDisplay(initialVisits);

            popupIframe.removeAttribute("srcdoc");
            popupIframe.src = "about:blank";
            if (sitePopupModal) sitePopupModal.style.display = "flex";

            setTimeout(() => {
                popupIframe.src = activeSite.url;
            }, 50);

            if (activeSite.id && updateHistory) {
                try {
                    const { db, mods } = await getFirebaseDB();
                    const siteDocRef = mods.doc(db, "websites", activeSite.id);
                    await mods.updateDoc(siteDocRef, { views: mods.increment(1) });
                    activeSite.views = (Number(activeSite.views || activeSite.visits || 0) + 1);
                    updateVisitDisplay(activeSite.views);
                } catch (err) {
                    console.error("View increment error:", err);
                }
            }

            if (updateHistory) {
                const slug = getSiteSlug(activeSite);
                if (slug) {
                    window.history.pushState({ siteId: activeSite.id }, '', `#${slug}`);
                }
            }

            startVisitPolling();
        }
    }

    function updateVisitDisplay(count) {
        if (popupVisitCountEl) {
            popupVisitCountEl.textContent = `Total Visits: ${count.toLocaleString()}`;
        }
    }

    function startVisitPolling() {
        if (visitInterval) clearInterval(visitInterval);

        visitInterval = setInterval(async () => {
            if (activeSite && activeSite.id) {
                try {
                    const { db, mods } = await getFirebaseDB();
                    const siteDocRef = mods.doc(db, "websites", activeSite.id);
                    const docSnap = await mods.getDoc(siteDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const latestVisits = data.views || data.visits || 0;
                        activeSite.views = latestVisits;
                        updateVisitDisplay(latestVisits);
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }
        }, 7000);
    }

    if (popupRandomBtn) {
        popupRandomBtn.addEventListener("click", async () => {
            incrementPleaseClickClass = true;
            incrementPleaseClickCount();
            if (currentWebsitesList.length > 0) {
                const randomIndex = Math.floor(Math.random() * currentWebsitesList.length);
                openPopupWithSite(currentWebsitesList[randomIndex], true);
            }
        });
    }

    if (popupNewTabBtn) {
        popupNewTabBtn.addEventListener("click", () => {
            if (activeSite && activeSite.url) {
                window.open(activeSite.url, "_blank");
            }
        });
    }

    if (popupFullscreenBtn) {
        popupFullscreenBtn.addEventListener("click", () => {
            popupContainerBox.classList.toggle("fullscreen-mode");
            const icon = popupFullscreenBtn.querySelector("i");
            if (popupContainerBox.classList.contains("fullscreen-mode")) {
                icon.className = "icon-minimize";
            } else {
                icon.className = "icon-maximize";
            }
        });
    }

    function closePopup() {
        if (visitInterval) {
            clearInterval(visitInterval);
            visitInterval = null;
        }

        if (sitePopupModal) sitePopupModal.style.display = "none";
        popupIframe.src = "";
        popupIframe.removeAttribute("srcdoc");
        popupContainerBox.classList.remove("fullscreen-mode");
        if (popupFullscreenBtn) {
            popupFullscreenBtn.querySelector("i").className = "icon-maximize";
        }
        window.history.pushState({}, '', window.location.pathname);
    }

    if (popupCloseBtn) popupCloseBtn.addEventListener("click", closePopup);

    window.addEventListener("popstate", () => {
        const hash = window.location.hash;
        if (!hash && sitePopupModal && sitePopupModal.style.display === "flex") {
            closePopup();
        } else if (hash) {
            checkAndOpenFromUrl();
        }
    });

    if (sitePopupModal) {
        sitePopupModal.addEventListener("click", (e) => {
            if (e.target === sitePopupModal) {
                closePopup();
            }
        });
    }
});
