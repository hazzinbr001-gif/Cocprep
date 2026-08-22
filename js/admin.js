const adminState={questions:[],reports:[],payments:[],visibleCount:25};
const ADMIN_PAGE_SIZE=25;
const adminEl={
  nav:document.getElementById("adminNavBtn"),list:document.getElementById("adminQuestionList"),reports:document.getElementById("adminReportList"),
  search:document.getElementById("adminQuestionSearch"),section:document.getElementById("adminSectionFilter"),questionStatus:document.getElementById("adminQuestionStatus"),reportStatus:document.getElementById("adminReportStatus"),
  count:document.getElementById("adminQuestionCount"),reportCount:document.getElementById("adminReportCount"),pending:document.getElementById("adminPendingCount"),
  payments:document.getElementById("adminPaymentList"),paymentsStatus:document.getElementById("adminPaymentsStatus"),pendingPayments:document.getElementById("adminPendingPaymentsCount")
};
function adminEscape(value){return String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
function adminChoiceJson(value){try{return JSON.stringify(typeof value==="string"?JSON.parse(value):value??{},null,2)}catch(_){return String(value??"")}}

/**
 * Reformats choices + correct_answer when a question moves between
 * MCQ and True/False (either via the Swap button or the Section select).
 * MCQ shape:       choices = [{"key":"A","text":"..."}], correct_answer = "A"
 * True/False shape: choices = [{"key":"TRUE","text":"True"},{"key":"FALSE","text":"False"}], correct_answer = "TRUE" | "FALSE"
 * Existing option/statement text is preserved where possible; only the
 * key labels and default correct_answer are reshaped.
 */
function adminReshapeChoices(rawChoices, correctAnswer, targetType){
  let choices;
  try{ choices = typeof rawChoices==="string" ? JSON.parse(rawChoices) : rawChoices; }catch(_){ choices = null; }
  if(!Array.isArray(choices)) choices = [];

  if(targetType==="truefalse"){
    // Keep the question's own statement text as choice A's text if present,
    // otherwise fall back to generic True/False options.
    const firstText = choices[0]?.text || choices[0]?.statement || "";
    const newChoices = [{key:"TRUE",text:"True"},{key:"FALSE",text:"False"}];
    const newCorrect = (correctAnswer==="TRUE"||correctAnswer==="FALSE") ? correctAnswer : "TRUE";
    return { choices: newChoices, correct_answer: newCorrect, _note: firstText ? "" : "" };
  }

  // targetType === "mcq"
  if(choices.length && choices[0]?.key && !["TRUE","FALSE"].includes(String(choices[0].key).toUpperCase())){
    // Already looks like lettered MCQ choices — leave as-is.
    return { choices, correct_answer: correctAnswer, _note: "" };
  }
  // Coming from True/False shape or empty: seed with 4 empty lettered options.
  const letters=["A","B","C","D"];
  const newChoices = letters.map((k,i)=>({key:k, text: choices[i]?.text || ""}));
  const newCorrect = letters.includes(correctAnswer) ? correctAnswer : "A";
  return { choices: newChoices, correct_answer: newCorrect, _note: "Fill in the option text for each choice." };
}

/** Checks whether choices/correct_answer actually match the selected type, for a save-time warning. */
function adminChoicesMismatch(rawChoices, correctAnswer, questionType){
  let choices;
  try{ choices = typeof rawChoices==="string" ? JSON.parse(rawChoices) : rawChoices; }catch(_){ return "Choices is not valid JSON."; }
  if(!Array.isArray(choices) || !choices.length) return "Choices must be a non-empty array.";
  const keys = choices.map(c=>String(c.key||"").toUpperCase());
  if(questionType==="truefalse"){
    const isTF = keys.length===2 && keys.includes("TRUE") && keys.includes("FALSE");
    if(!isTF) return "Question type is True/False but choices aren't shaped as TRUE/FALSE.";
    if(!["TRUE","FALSE"].includes(String(correctAnswer||"").toUpperCase())) return "Correct answer should be TRUE or FALSE.";
  } else {
    if(keys.includes("TRUE")||keys.includes("FALSE")) return "Question type is MCQ but choices look like True/False.";
    if(!keys.includes(String(correctAnswer||"").toUpperCase())) return "Correct answer doesn't match any choice key.";
  }
  return "";
}

function adminQuestionCardHtml(q){
  const id=adminEscape(q.id);
  return '<details class="admin-question" data-id="'+id+'"><summary><span class="admin-question-section '+(q.section==="truefalse"?"is-premium":"")+'">'+(q.section==="truefalse"?"SECTION B":"SECTION A")+'</span><span class="admin-question-preview">'+adminEscape(q.question_text)+'</span><span class="admin-edit-label">Edit</span></summary><form class="admin-question-form" data-id="'+id+'"><div class="admin-form-grid"><label class="admin-field admin-field-wide"><span>Question wording</span><textarea name="question_text" rows="3" required>'+adminEscape(q.question_text)+'</textarea></label><label class="admin-field admin-field-wide"><span>Choices JSON</span><textarea name="choices" rows="5" required>'+adminEscape(adminChoiceJson(q.choices))+'</textarea><small>Example: [{"key":"A","text":"Option one"}]</small></label><label class="admin-field"><span>Correct answer</span><input name="correct_answer" value="'+adminEscape(q.correct_answer)+'" required></label><label class="admin-field"><span>Section</span><select name="section"><option value="mcq" '+(q.section==="mcq"?"selected":"")+'>Section A · MCQ</option><option value="truefalse" '+(q.section==="truefalse"?"selected":"")+'>Section B · True / False</option></select></label><label class="admin-field"><span>Question type</span><select name="question_type"><option value="mcq" '+(q.question_type==="mcq"?"selected":"")+'>MCQ</option><option value="truefalse" '+(q.question_type==="truefalse"?"selected":"")+'>True / False</option></select></label><label class="admin-field admin-field-wide"><span>Swap section</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-secondary btn-sm admin-swap-btn" data-target="mcq">Convert to MCQ</button><button type="button" class="btn btn-secondary btn-sm admin-swap-btn" data-target="truefalse">Convert to True/False</button><small class="admin-swap-hint" style="color:#73817e">Reformats choices &amp; correct answer to match. Review option text after swapping.</small></div></label><label class="admin-field"><span>Subject</span><input name="subject" value="'+adminEscape(q.subject)+'"></label><label class="admin-field"><span>Topic</span><input name="topic" value="'+adminEscape(q.topic)+'"></label><label class="admin-field"><span>Unit</span><input name="unit" value="'+adminEscape(q.unit)+'"></label><label class="admin-field"><span>Difficulty</span><input name="difficulty" value="'+adminEscape(q.difficulty)+'"></label><label class="admin-field admin-field-wide"><span>Explanation</span><textarea name="explanation" rows="4">'+adminEscape(q.explanation)+'</textarea></label><label class="admin-free-toggle"><input type="checkbox" name="is_free" '+(q.is_free?"checked":"")+'> Available in Section A free pool</label></div><div class="admin-form-actions"><span class="admin-save-status"></span><button class="btn btn-primary btn-sm" type="submit">Save correction</button></div></form></details>';
}
function adminFilteredQuestions(){
  const search=(adminEl.search?.value||"").toLowerCase().trim(),section=adminEl.section?.value||"";
  return adminState.questions.filter(q=>(!section||q.section===section)&&(!search||[q.question_text,q.subject,q.topic].some(v=>String(v||"").toLowerCase().includes(search))));
}
function renderAdminQuestions(resetPage){
  if(resetPage)adminState.visibleCount=ADMIN_PAGE_SIZE;
  const rows=adminFilteredQuestions();
  if(!rows.length){adminEl.list.innerHTML='<div class="admin-empty">No questions match this filter.</div>';return}
  const visible=rows.slice(0,adminState.visibleCount);
  let html=visible.map(adminQuestionCardHtml).join("");
  if(rows.length>visible.length){
    html+='<div class="admin-load-more-wrap" style="padding:16px 0;text-align:center"><button type="button" class="btn btn-secondary btn-sm" id="adminLoadMoreQuestionsBtn">Load more ('+(rows.length-visible.length)+' remaining)</button></div>';
  }
  adminEl.list.innerHTML=html;
  const loadMoreBtn=document.getElementById("adminLoadMoreQuestionsBtn");
  if(loadMoreBtn)loadMoreBtn.addEventListener("click",()=>{adminState.visibleCount+=ADMIN_PAGE_SIZE;renderAdminQuestions(false)});
}
function reportLabel(reason){return String(reason||"other").replaceAll("_"," ")}
function renderAdminReports(){if(!adminState.reports.length){adminEl.reports.innerHTML='<div class="admin-empty">No reported issues yet.</div>';return}adminEl.reports.innerHTML=adminState.reports.map(r=>'<form class="admin-report" data-id="'+adminEscape(r.id)+'"><div class="admin-report-top"><div><span class="admin-question-section '+(r.questions?.section==="truefalse"?"is-premium":"")+'">'+(r.questions?.section==="truefalse"?"SECTION B":"SECTION A")+'</span><strong>'+adminEscape(reportLabel(r.reason))+'</strong></div><span class="admin-report-date">'+adminEscape(new Date(r.created_at).toLocaleDateString())+'</span></div><p class="admin-report-question">'+adminEscape(r.questions?.question_text||"Question unavailable")+'</p><p class="admin-report-details">'+adminEscape(r.details||"No additional details provided.")+'</p><div class="admin-report-controls"><select name="status"><option value="pending" '+(r.status==="pending"?"selected":"")+'>Pending</option><option value="under_review" '+(r.status==="under_review"?"selected":"")+'>Under review</option><option value="question_updated" '+(r.status==="question_updated"?"selected":"")+'>Question updated</option><option value="resolved" '+(r.status==="resolved"?"selected":"")+'>Resolved</option><option value="rejected" '+(r.status==="rejected"?"selected":"")+'>Rejected</option></select><input name="admin_notes" placeholder="Admin notes" value="'+adminEscape(r.admin_notes)+'"><button class="btn btn-secondary btn-sm" type="submit">Save report</button></div></form>').join("")}

function paymentCardHtml(p){
  const id=adminEscape(p.id);
  const who=adminEscape(p.user_email||p.user_id);
  const when=adminEscape(new Date(p.created_at).toLocaleString());
  return '<div class="admin-report" data-id="'+id+'"><div class="admin-report-top"><div><strong>'+who+'</strong></div><span class="admin-report-date">'+when+'</span></div>'
    +'<p class="admin-report-question">M-Pesa code: <strong>'+adminEscape(p.mpesa_code)+'</strong> &middot; Amount: KSh '+adminEscape(p.amount)+'</p>'
    +'<div class="admin-report-controls">'
    +'<button type="button" class="btn btn-primary btn-sm admin-payment-approve" data-id="'+id+'">Approve</button>'
    +'<button type="button" class="btn btn-secondary btn-sm admin-payment-reject" data-id="'+id+'">Reject</button>'
    +'</div></div>';
}
function renderAdminPayments(){
  if(!adminState.payments.length){adminEl.payments.innerHTML='<div class="admin-empty">No pending payments.</div>';return}
  adminEl.payments.innerHTML=adminState.payments.map(paymentCardHtml).join("");
}
async function loadAdminPayments(){
  adminEl.paymentsStatus.textContent="Loading payments…";
  try{
    const res=await apiAdminPayments({action:"list",status:"pending"});
    adminState.payments=res.payments||[];
    adminEl.pendingPayments.textContent=adminState.payments.length;
    adminEl.paymentsStatus.textContent="";
    renderAdminPayments();
  }catch(e){
    adminEl.paymentsStatus.textContent=e.message||"Could not load payments.";
    adminEl.payments.innerHTML='<div class="admin-empty admin-error">Payments unavailable.</div>';
  }
}
adminEl.payments?.addEventListener("click",async e=>{
  const approveBtn=e.target.closest(".admin-payment-approve");
  const rejectBtn=e.target.closest(".admin-payment-reject");
  const btn=approveBtn||rejectBtn;
  if(!btn)return;
  const paymentId=btn.dataset.id;
  let rejection_reason=null;
  if(rejectBtn){
    rejection_reason=prompt("Reason for rejecting this payment (optional):")||null;
  }
  btn.disabled=true;
  try{
    await apiAdminPayments({action:"decide",payment_id:paymentId,decision:approveBtn?"approved":"rejected",rejection_reason});
    await loadAdminPayments();
  }catch(err){
    adminEl.paymentsStatus.textContent=err.message||"Could not update payment.";
    btn.disabled=false;
  }
});
document.getElementById("adminRefreshPaymentsBtn")?.addEventListener("click",loadAdminPayments);

async function refreshAdminAccess(){try{await apiAdminQuestions({action:"list",limit:1});if(adminEl.nav)adminEl.nav.hidden=false;const menuAdmin=document.getElementById("menuAdminBtn");if(menuAdmin)menuAdmin.hidden=false}catch(_){if(adminEl.nav)adminEl.nav.hidden=true;const menuAdmin=document.getElementById("menuAdminBtn");if(menuAdmin)menuAdmin.hidden=true}}
async function loadAdmin(){adminEl.questionStatus.textContent="Loading questions and reports…";try{const [q,r]=await Promise.all([apiAdminQuestions({action:"list",limit:500}),apiAdminReports({action:"list"})]);adminState.questions=q.questions||[];adminState.reports=r.reports||[];adminEl.count.textContent=adminState.questions.length;adminEl.reportCount.textContent=adminState.reports.length;adminEl.pending.textContent=r.pending_reports??adminState.reports.filter(x=>x.status==="pending").length;adminEl.questionStatus.textContent="";renderAdminQuestions(true);renderAdminReports();if(adminEl.nav)adminEl.nav.hidden=false}catch(e){adminEl.questionStatus.textContent=e.message||"Could not load admin data.";adminEl.list.innerHTML='<div class="admin-empty admin-error">Admin access is unavailable.</div>';}
  loadAdminPayments();
}
adminEl.search?.addEventListener("input",()=>renderAdminQuestions(true));adminEl.section?.addEventListener("change",()=>renderAdminQuestions(true));document.getElementById("adminLoadQuestionsBtn")?.addEventListener("click",loadAdmin);document.getElementById("adminRefreshBtn")?.addEventListener("click",loadAdmin);
adminEl.list?.addEventListener("click",e=>{
  const btn=e.target.closest(".admin-swap-btn");
  if(!btn)return;
  const form=btn.closest("form.admin-question-form");
  const target=btn.dataset.target; // "mcq" or "truefalse"
  const choicesField=form.querySelector('[name="choices"]');
  const correctField=form.querySelector('[name="correct_answer"]');
  const sectionField=form.querySelector('[name="section"]');
  const typeField=form.querySelector('[name="question_type"]');
  const reshaped=adminReshapeChoices(choicesField.value,correctField.value,target);
  choicesField.value=JSON.stringify(reshaped.choices,null,2);
  correctField.value=reshaped.correct_answer;
  sectionField.value=target;
  typeField.value=target;
  const status=form.querySelector(".admin-save-status");
  status.textContent=target==="truefalse"?"Converted to True/False — review the option text, then save.":"Converted to MCQ — fill in each option's text, then save.";
  status.className="admin-save-status";
});
adminEl.list?.addEventListener("submit",async e=>{if(!e.target.matches(".admin-question-form"))return;e.preventDefault();const form=e.target,button=form.querySelector("button[type=submit]"),status=form.querySelector(".admin-save-status");const data=new FormData(form);const mismatch=adminChoicesMismatch(data.get("choices"),data.get("correct_answer"),data.get("question_type"));if(mismatch&&!confirm(mismatch+"\n\nSave anyway?"))return;button.disabled=true;status.textContent="Saving…";try{await apiAdminQuestions({action:"update_question",question_id:form.dataset.id,question_text:data.get("question_text"),choices:data.get("choices"),correct_answer:data.get("correct_answer"),explanation:data.get("explanation"),section:data.get("section"),question_type:data.get("question_type"),subject:data.get("subject"),topic:data.get("topic"),unit:data.get("unit"),difficulty:data.get("difficulty"),is_free:data.get("is_free")==="on"});status.textContent="Saved";status.className="admin-save-status is-success"}catch(e){status.textContent=e.message||"Save failed";status.className="admin-save-status is-error"}finally{button.disabled=false}});adminEl.reports?.addEventListener("submit",async e=>{if(!e.target.matches(".admin-report"))return;e.preventDefault();const form=e.target,button=form.querySelector("button[type=submit]"),data=new FormData(form);button.disabled=true;try{await apiAdminReports({action:"update",report_id:form.dataset.id,status:data.get("status"),admin_notes:data.get("admin_notes")});adminEl.reportStatus.textContent="Report updated.";await loadAdmin()}catch(err){adminEl.reportStatus.textContent=err.message||"Could not update report."}finally{button.disabled=false}});
