import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCm8uS2WbwleHbH486e9YA7RTKMJHlmkNo",
  authDomain: "car-qr-code-e5957.firebaseapp.com",
  projectId: "car-qr-code-e5957",
  storageBucket: "car-qr-code-e5957.firebasestorage.app",
  messagingSenderId: "275162324080",
  appId: "1:275162324080:web:4574d1fbc96d8cd2e8a8b5",
  measurementId: "G-5DFV6NX7WC",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const cardId = params.get("id");

initCardFlow();

async function initCardFlow() {
  if (!cardId) {
    app.innerHTML =
      "<p>الرابط غير مكتمل: برجاء إضافة <strong>?id=رقم_الكارت</strong> في نهاية الرابط.</p>";
    return;
  }

  app.innerHTML = "<p>جاري تحميل بيانات الكارت...</p>";

  try {
    const cardRef = doc(db, "cards", cardId);
    const snap = await getDoc(cardRef);

    if (!snap.exists()) {
      app.innerHTML = `<p class="error-msg">الكارت (${escapeHtml(cardId)}) غير مسجل في النظام.</p>`;
      return;
    }

    const cardData = snap.data();

    if (!cardData.isClaimed) {
      renderRegisterForm(cardRef, cardId);
    } else {
      renderProfileView(cardRef, cardId, cardData);
    }
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="error-msg">حدث خطأ أثناء الاتصال بقاعدة البيانات.</p>`;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWhatsAppNumber(rawPhone) {
  let cleaned = String(rawPhone || "").replace(/\D/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("01")) {
    cleaned = "20" + cleaned.slice(1);
  }

  return cleaned;
}

function formatCallNumber(rawPhone) {
  let cleaned = String(rawPhone || "").replace(/[^\d+]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  return cleaned;
}

function renderRegisterForm(cardRef, cardId) {
  app.innerHTML = `
    <h2>تفعيل كارت جديد (${escapeHtml(cardId)})</h2>
    <form id="registerForm">
      <div class="field">
        <label for="nameInput">الاسم</label>
        <input type="text" id="nameInput" required />
      </div>
      <div class="field">
        <label for="phoneInput">رقم التليفون</label>
        <input type="tel" id="phoneInput" required />
      </div>
      <div class="field">
        <label for="pinInput">الرقم السري للتعديل لاحقاً</label>
        <input type="password" id="pinInput" required />
      </div>
      <button type="submit">حفظ البيانات</button>
      <p id="regError" class="error-msg"></p>
    </form>
  `;

  const form = document.getElementById("registerForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ownerName = document.getElementById("nameInput").value.trim();
    const phone = document.getElementById("phoneInput").value.trim();
    const pin = document.getElementById("pinInput").value.trim();
    const regError = document.getElementById("regError");

    if (!ownerName || !phone || !pin) return;

    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "جاري الحفظ...";

    try {
      const payload = {
        isClaimed: true,
        ownerName,
        phone,
        pin,
      };
      await updateDoc(cardRef, payload);
      renderProfileView(cardRef, cardId, payload);
    } catch (err) {
      console.error(err);
      regError.textContent = "تعذر حفظ البيانات، حاول مرة أخرى.";
      btn.disabled = false;
      btn.textContent = "حفظ البيانات";
    }
  });
}

function renderProfileView(cardRef, cardId, cardData) {
  const waPhone = formatWhatsAppNumber(cardData.phone);
  const callPhone = formatCallNumber(cardData.phone);
  const waMessage = encodeURIComponent(
    `مرحباً ${cardData.ownerName}، تواصلت معك بخصوص الكارت (${cardId}).`
  );
  const whatsappUrl = `https://wa.me/${waPhone}?text=${waMessage}`;
  const callUrl = `tel:${callPhone}`;

  app.innerHTML = `
    <h2>بيانات المالك</h2>
    <p class="notice-msg">عفواً لو عربيتي مسببالك أي إزعاج، يسعدني تواصلك معي فوراً:</p>
    <div class="info-box owner-card">
      <p class="owner-name"><strong>المالك:</strong> ${escapeHtml(cardData.ownerName)}</p>
      <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="whatsapp-btn">
        <span>💬</span>
        <span>للتواصل واتساب</span>
      </a>
      <a href="${callUrl}" class="call-btn">
        <span>📞</span>
        <span>اتصال مباشر</span>
      </a>
    </div>
    <button id="editBtn" class="edit-btn" type="button">تعديل البيانات</button>
    <div id="editSection"></div>
  `;

  document.getElementById("editBtn").addEventListener("click", () => {
    const editSection = document.getElementById("editSection");
    editSection.innerHTML = `
      <hr />
      <h3>تأكيد الهوية للتعديل</h3>
      <div class="field">
        <input type="password" id="verifyPinInput" placeholder="أدخل الرقم السري" />
      </div>
      <button id="verifyPinBtn" type="button">تأكيد</button>
      <p id="pinError" class="error-msg"></p>
    `;

    const pinInput = document.getElementById("verifyPinInput");
    const verifyBtn = document.getElementById("verifyPinBtn");
    const pinError = document.getElementById("pinError");

    const checkPin = () => {
      const enteredPin = pinInput.value.trim();
      const savedPin = String(cardData.pin ?? "").trim();

      if (!enteredPin) {
        pinError.textContent = "من فضلك أدخل الرقم السري أولاً.";
        return;
      }

      if (enteredPin !== savedPin) {
        pinError.textContent = "الرقم السري غير صحيح.";
        return;
      }

      renderEditForm(cardRef, cardId, cardData);
    };

    verifyBtn.addEventListener("click", checkPin);
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkPin();
      }
    });
  });
}

function renderEditForm(cardRef, cardId, cardData) {
  const editSection = document.getElementById("editSection");
  if (!editSection) return;

  editSection.innerHTML = `
    <hr />
    <h3>تعديل بيانات المالك</h3>
    <form id="editForm">
      <div class="field">
        <label for="editNameInput">الاسم</label>
        <input type="text" id="editNameInput" value="${escapeHtml(cardData.ownerName)}" required />
      </div>
      <div class="field">
        <label for="editPhoneInput">رقم التليفون</label>
        <input type="tel" id="editPhoneInput" value="${escapeHtml(cardData.phone)}" required />
      </div>
      <button type="submit">حفظ التعديلات</button>
      <p id="editError" class="error-msg"></p>
    </form>
  `;

  const form = document.getElementById("editForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const updatedName = document.getElementById("editNameInput").value.trim();
    const updatedPhone = document.getElementById("editPhoneInput").value.trim();
    const editError = document.getElementById("editError");

    if (!updatedName || !updatedPhone) return;

    const btn = form.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "جاري التحديث...";

    try {
      await updateDoc(cardRef, {
        ownerName: updatedName,
        phone: updatedPhone,
      });

      const updatedData = {
        ...cardData,
        ownerName: updatedName,
        phone: updatedPhone,
      };
      renderProfileView(cardRef, cardId, updatedData);
    } catch (err) {
      console.error(err);
      editError.textContent = "تعذر حفظ التعديلات، حاول مرة أخرى.";
      btn.disabled = false;
      btn.textContent = "حفظ التعديلات";
    }
  });
}
```[cite: 1, 2, 3]

هل تحب نضيف أي لمسة إضافية في الصفحة (مثل إظهار رقم المالك أو تغيير شكل الخلفية أو الأيقونات)؟
