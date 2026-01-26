// Console warning injected by deploy script
(function(){
  function warn(){
    try{ console.clear(); }catch(e){}
    console.log(
      "%cCẢNH BÁO NGUY HIỂM!",
      "color: white; background: red; font-size: 50px; font-weight: bold; padding: 10px; border: 5px solid darkred;"
    );

    console.log(
      "%cĐÂY LÀ HỆ THỐNG CÔNG CỤ ĐIỀU HÀNH CỦA CƠ QUAN NHÀ NƯỚC",
      "font-size: 20px; color: red; font-weight: bold; margin-top: 20px;"
    );

    console.log(
      "%cMọi hành vi can thiệp trái phép vào mã nguồn, phá hoại hệ thống hoặc cố tình đánh cắp dữ liệu đều là vi phạm pháp luật và sẽ bị truy cứu trách nhiệm hình sự theo Luật An ninh mạng số 24/2018/QH14.",
      "font-size: 16px; color: black; line-height: 1.5; font-weight: bold;"
    );

    console.log(
      "%cĐịa chỉ IP và hành động của bạn đã được hệ thống ghi nhận tự động. Nếu bạn không phải là quản trị viên được ủy quyền, vui lòng ĐÓNG CỬA SỔ NÀY NGAY LẬP TỨC để tránh các rắc rối pháp lý không đáng có.",
      "font-size: 14px; color: #333; font-style: italic; border-left: 4px solid red; padding-left: 10px; margin-top: 10px;"
    );

    console.log(
      "%cỦY BAN NHÂN DÂN XÃ NÚI CẤM - BAN QUẢN TRỊ HỆ THỐNG",
      "font-size: 14px; color: blue; font-weight: bold; margin-top: 20px;"
    );
  }

  // Print once now
  warn();

  // Re-print and clear periodically
  setInterval(function(){ try{ console.clear(); warn(); }catch(e){} }, 15000);

  // Override console methods to clear before any further console output
  (function(){
    var methods = ['log','info','warn','error','debug'];
    methods.forEach(function(m){
      var orig = console[m];
      console[m] = function(){
        try{ console.clear(); }catch(e){}
        if (orig && orig.apply) { orig.apply(console, arguments); }
      };
    });
  })();
})();
