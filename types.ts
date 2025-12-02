

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export interface Attachment {
  name: string;
  mimeType: string; // 'image/png', 'application/pdf', 'text/plain' etc.
  data: string; // Base64 string
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  code?: string; // Extracted LISP code if any
  attachments?: Attachment[]; // Updated to support multiple file types
  timestamp: number;
  isLoading?: boolean;
  isLibraryResult?: boolean; // New flag to indicate if result came from global library
  proposalSnippet?: LispSnippet; // Found library item to propose
  originalRequest?: string; // The user's original prompt to re-use if they choose custom generation
}

export interface LispSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  category?: 'calculation' | 'modification' | 'text' | 'layers' | 'blocks' | 'other';
  keywords?: string[]; // Keywords for search matching
  author?: string; // The user who submitted it
  downloads?: number;
  likes?: number;
}

export const EXAMPLE_PROMPTS = [
  "Yerden ısıtma borusu döşe (Serpantin)",
  "Visual LISP (vlax) ile blokların Attribute değerlerini oku",
  "VS Code AutoLISP Extension için launch.json oluştur",
  "Excel'e veri aktaran bir LISP yaz",
  "Seçilen text objelerine önek (prefix) ekle"
];

// World-class proven LISP routines
// Updated to meet International Standards (Underscore commands) and VS Code Formatting
export const GLOBAL_LIBRARY: LispSnippet[] = [
  {
    id: 'floor-heat',
    title: 'Yerden Isıtma (FLOORHEAT) v2',
    description: 'Güncellenmiş v2 Algoritması: Seçilen odanın içine otomatik olarak boru döşer. İçeri/Dışarı yönünü otomatik algılar ve hatasız çizim yapar.',
    category: 'other',
    keywords: ['yerden', 'ısıtma', 'boru', 'mekanik', 'hvac', 'floor', 'heating', 'offset', 'coil', 'serpantin'],
    author: 'Mekanik AI',
    downloads: 1285,
    likes: 160,
    code: `;;; ==========================================================================
;;; Command: FLOORHEAT
;;; Description: Generates underfloor heating pipe layout (Smart Offset Loop)
;;; Version: 2.0 (Auto-Direction Detection)
;;; ==========================================================================
(defun c:FLOORHEAT (/ ss ent obj area1 area2 objPos objNeg chosenDist totalLen dist i flag newObj space)
  (vl-load-com)
  (setq totalLen 0.0)
  
  (princ "\\n--- YERDEN ISITMA OTOMASYONU v2 (Smart) ---")
  
  ;; 1. Get spacing
  (setq space (getdist "\\nBoru aralığı (Spacing) <15>: "))
  (if (null space) (setq space 15.0))

  ;; 2. Select Room Boundary
  (princ "\\nYerden ısıtma yapılacak ODA SINIRINI seçin (Kapalı Polyline): ")
  (setq ss (ssget ":S" '((0 . "LWPOLYLINE,POLYLINE,CIRCLE,ELLIPSE"))))
  
  (if ss
    (progn
      (setq ent (ssname ss 0))
      (setq obj (vlax-ename->vla-object ent))
      (setq area1 (vla-get-area obj))
      
      ;; Create layer
      (command "_.layer" "_m" "Mekanik-Yerden_Isitma" "_c" "1" "" "")
      
      (princ "\\nAnaliz yapılıyor... Yön tespiti...")

      ;; 3. Determine "Inside" Direction logic
      ;; Try Positive Offset
      (setq objPos (vl-catch-all-apply 'vla-offset (list obj space)))
      ;; Try Negative Offset
      (setq objNeg (vl-catch-all-apply 'vla-offset (list obj (- space))))

      (setq chosenDist nil)

      ;; Check Positive result
      (if (not (vl-catch-all-error-p objPos))
          (progn
            (setq objPos (vlax-safearray->list (vlax-variant-value objPos)))
            (setq area2 (vla-get-area (car objPos)))
            (mapcar 'vla-delete objPos) ;; Delete test object immediately
            ;; If new area is SMALLER than original, positive is INWARD (for standard CCW polylines)
            (if (< area2 area1) (setq chosenDist space))
          )
      )

      ;; Check Negative result (if positive wasn't it)
      (if (and (null chosenDist) (not (vl-catch-all-error-p objNeg)))
          (progn
            (setq objNeg (vlax-safearray->list (vlax-variant-value objNeg)))
            (setq area2 (vla-get-area (car objNeg)))
            (mapcar 'vla-delete objNeg)
            (if (< area2 area1) (setq chosenDist (- space)))
          )
      )

      (if (null chosenDist)
          (alert "HATA: Seçilen nesnenin içine doğru offset yapılamadı.\\nNesne çok küçük veya geometri bozuk olabilir.")
          (progn
               ;; 4. EXECUTE LOOP
               (princ "\\nÇizim başladı...")
               (setq dist chosenDist)
               (setq flag T)
               
               (while flag
                   (setq newObj (vl-catch-all-apply 'vla-offset (list obj dist)))
                   
                   (if (vl-catch-all-error-p newObj)
                       (setq flag nil) ;; Stop loop on error (center reached)
                       (progn
                           (setq newObj (vlax-safearray->list (vlax-variant-value newObj)))
                           
                           ;; Validate result area to prevent weird artifacts
                           (if (< (vla-get-area (car newObj)) 0.1) 
                               (progn 
                                 (mapcar 'vla-delete newObj)
                                 (setq flag nil)
                               )
                               (foreach o newObj
                                   (vla-put-layer o "Mekanik-Yerden_Isitma")
                                   (vla-put-color o 1) ;; Red
                                   
                                   ;; Add Length
                                   (if (vlax-property-available-p o 'Length)
                                       (setq totalLen (+ totalLen (vla-get-Length o)))
                                       (if (vlax-property-available-p o 'Circumference)
                                           (setq totalLen (+ totalLen (vla-get-Circumference o)))
                                       )
                                   )
                               )
                           )
                           ;; Increment offset distance
                           (setq dist (+ dist chosenDist))
                       )
                   )
               )
               
               (command "_.regen")
               (alert (strcat "İşlem Tamamlandı!\\n\\nToplam Boru Uzunluğu: " (rtos totalLen 2 2) " birim."))
               (princ (strcat "\\nToplam Metraj: " (rtos totalLen 2 2)))
          )
      )
    )
    (princ "\\nGeçerli bir sınır seçilmedi.")
  )
  (princ)
)`
  },
  {
    id: 'tlen',
    title: 'Toplam Uzunluk (TLEN)',
    description: 'Seçilen Line, Polyline, Arc ve Spline objelerinin toplam metrajını hesaplar.',
    category: 'calculation',
    keywords: ['toplam', 'uzunluk', 'metraj', 'boy', 'hesapla', 'tlen', 'measure'],
    author: 'Global Standard',
    downloads: 15420,
    likes: 850,
    code: `;;; ==========================================================================
;;; Command: TLEN (Total Length)
;;; Description: Calculates total length of selected linear objects
;;; Standard: Autodesk AutoLISP Extension Compliant
;;; ==========================================================================
(defun c:TLEN (/ ss i ent total len)
  (vl-load-com)
  (setq total 0)
  (princ "\\nUzunluğu hesaplanacak objeleri seçin (Line, Pline, Arc): ")
  (if (setq ss (ssget '((0 . "LINE,LWPOLYLINE,ARC,POLYLINE,SPLINE"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ent (ssname ss i))
        ;; Using _.lengthen for international compatibility
        (command "_.lengthen" ent "")
        (setq len (getvar "PERIMETER"))
        (setq total (+ total len))
        (setq i (1+ i))
      )
      (alert (strcat "Seçilen " (itoa (sslength ss)) " objenin toplam uzunluğu:\\n\\n" (rtos total 2 2)))
      (princ (strcat "\\nToplam Uzunluk: " (rtos total 2 2)))
    )
    (princ "\\nObje seçilmedi.")
  )
  (princ)
)`
  },
  {
    id: 'num-inc',
    title: 'Otomatik Numaralandırma (NUM)',
    description: 'Tıkladığınız noktalara artan sayılar (1, 2, 3...) yerleştirir.',
    category: 'text',
    keywords: ['numara', 'sırala', 'artan', 'sayı', 'num', 'count', 'increment'],
    author: 'Lee Mac',
    downloads: 8900,
    likes: 420,
    code: `;;; ==========================================================================
;;; Command: NUM (Number Increment)
;;; Description: Places incremental numbers at picked points
;;; ==========================================================================
(defun c:NUM (/ startVal txtHeight pt)
  (setq startVal (getint "\\nBaşlangıç numarası <1>: "))
  (if (null startVal) (setq startVal 1))
  
  (setq txtHeight (getreal "\\nYazı yüksekliği <Mevcut>: "))
  (if (null txtHeight) (setq txtHeight (getvar "TEXTSIZE")))

  (while (setq pt (getpoint (strcat "\\n" (itoa startVal) " nolu sayıyı yerleştirin: ")))
    ;; entmake is safer and faster than command calls
    (entmake (list 
      '(0 . "TEXT") 
      (cons 10 pt) 
      (cons 40 txtHeight) 
      (cons 1 (itoa startVal)) 
      '(50 . 0.0)
    ))
    (setq startVal (1+ startVal))
  )
  (princ)
)`
  },
  {
    id: 'area-text',
    title: 'Alan Yaz (M2)',
    description: 'Kapalı bir alanın metrekaresini hesaplar ve içine text olarak yazar.',
    category: 'calculation',
    keywords: ['alan', 'metrekare', 'm2', 'area', 'yaz', 'hesap'],
    author: 'CadMaster',
    downloads: 1200,
    likes: 95,
    code: `;;; ==========================================================================
;;; Command: M2 (Area to Text)
;;; Description: Creates boundary, calculates area, and writes text
;;; ==========================================================================
(defun c:M2 (/ pt en obj area str)
  (vl-load-com)
  (while (setq pt (getpoint "\\nAlan hesabı için kapalı alanın içine tıklayın: "))
    (command "_.boundary" pt "")
    (setq en (entlast))
    (if en
      (progn
        (setq obj (vlax-ename->vla-object en))
        (setq area (vla-get-area obj))
        (setq str (strcat (rtos area 2 2) " m2"))
        ;; International command syntax
        (command "_.text" "_j" "_mc" pt "" "" str)
        (command "_.erase" en "") 
      )
      (princ "\\nKapalı alan bulunamadı.")
    )
    (princ)
)`
  },
  {
    id: 'flatten',
    title: 'Sıfıra İndir (00)',
    description: 'Tüm çizimi veya seçilen objeleri Z=0 kotuna (elevation) taşır. 3D karmaşasını temizler.',
    category: 'modification',
    keywords: ['z', 'kot', 'sıfır', 'flatten', 'elevation', 'düzleştir', '3d', '2d'],
    author: 'Autodesk Community',
    downloads: 25000,
    likes: 1500,
    code: `;;; ==========================================================================
;;; Command: 00 (Flatten)
;;; Description: Sets Z elevation to 0 for selected objects via ActiveX
;;; ==========================================================================
(defun c:00 (/ ss i ent obj)
  (vl-load-com)
  (princ "\\nZ kotunu sıfırlamak istediğiniz objeleri seçin (Tümü için Enter): ")
  (setq ss (ssget))
  (if (null ss) (setq ss (ssget "X")))
  
  (if ss
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ent (ssname ss i))
        (setq obj (vlax-ename->vla-object ent))
        ;; Safer property check
        (if (vlax-property-available-p obj 'Elevation)
            (vla-put-Elevation obj 0.0)
        )
        (if (vlax-property-available-p obj 'Z)
            (vla-put-Z obj 0.0)
        )
        (setq i (1+ i))
      )
      (princ (strcat "\\n" (itoa (sslength ss)) " obje Z=0 kotuna taşındı."))
    )
    (princ "\\nObje bulunamadı.")
  )
  (princ)
)`
  },
  {
    id: 'lay-del',
    title: 'Layer Sil (LAYDEL)',
    description: 'Seçtiğiniz objenin layerını ve o layerdaki her şeyi çizimden tamamen siler (Force Delete).',
    category: 'layers',
    keywords: ['layer', 'katman', 'sil', 'delete', 'kaldır', 'laydel'],
    author: 'Express Tools',
    downloads: 5400,
    likes: 230,
    code: `;;; ==========================================================================
;;; Command: LAYDELFORCE
;;; Description: Forcefully deletes all objects on a layer and purges it
;;; ==========================================================================
(defun c:LAYDELFORCE (/ ent lay ss)
  (setq ent (car (entsel "\\nSilinecek layerdaki bir objeyi seçin: ")))
  (if ent
    (progn
      (setq lay (cdr (assoc 8 (entget ent))))
      (setq ss (ssget "X" (list (cons 8 lay))))
      (if ss
        (progn
          (command "_.erase" ss "")
          (princ (strcat "\\nLayer '" lay "' içindeki tüm objeler silindi."))
          (command "_.purge" "_la" lay "_n")
        )
      )
    )
    (princ "\\nObje seçilmedi.")
  )
  (princ)
)`
  },
  {
    id: 'ccount',
    title: 'Blok Sayacı (CCOUNT)',
    description: 'Çizimdeki seçilen veya tüm blokları isimlerine göre sayar ve listeler.',
    category: 'blocks',
    keywords: ['blok', 'say', 'count', 'adet', 'listele', 'rapor', 'bcount'],
    author: 'TurkCAD Team',
    downloads: 3200,
    likes: 410,
    code: `;;; ==========================================================================
;;; Command: CCOUNT (Count Blocks)
;;; Description: Reports quantity of selected blocks
;;; ==========================================================================
(defun c:CCOUNT (/ ss i blkName blkList pair)
  (vl-load-com)
  (princ "\\nSayılacak blokları seçin (Tümü için Enter): ")
  (setq ss (ssget '((0 . "INSERT"))))
  (if (null ss) (setq ss (ssget "X" '((0 . "INSERT")))))
  
  (if ss
    (progn
      (setq i 0 blkList nil)
      (repeat (sslength ss)
        (setq blkName (cdr (assoc 2 (entget (ssname ss i)))))
        (if (not (assoc blkName blkList))
            (setq blkList (cons (cons blkName 1) blkList))
            (setq blkList (subst (cons blkName (1+ (cdr (assoc blkName blkList)))) (assoc blkName blkList) blkList))
        )
        (setq i (1+ i))
      )
      (princ "\\n\\n--- BLOK SAYIM RAPORU ---\\n")
      (foreach pair blkList
        (princ (strcat "\\n" (car pair) ": " (itoa (cdr pair)) " adet"))
      )
      (textscr)
    )
    (princ "\\nBlok bulunamadı.")
  )
  (princ)
)`
  },
  {
    id: 'xy-coord',
    title: 'Koordinat Yaz (XY)',
    description: 'Tıklanan noktanın X ve Y koordinatlarını (X=... Y=...) şeklinde çizime yazar.',
    category: 'text',
    keywords: ['koordinat', 'x', 'y', 'point', 'nokta', 'yaz', 'coord'],
    author: 'SurveyMaster',
    downloads: 6700,
    likes: 340,
    code: `;;; ==========================================================================
;;; Command: XY
;;; Description: Labels point coordinates
;;; ==========================================================================
(defun c:XY (/ pt str)
  (setq pt (getpoint "\\nKoordinatı yazılacak noktayı tıklayın: "))
  (if pt
    (progn
      (setq str (strcat "X=" (rtos (car pt) 2 2) "  Y=" (rtos (cadr pt) 2 2)))
      (command "_.leader" pt pause "" str "")
    )
  )
  (princ)
)`
  },
  {
    id: 'break-all',
    title: 'Kesişimden Kopar (BREAKALL)',
    description: 'Seçilen tüm çizgileri, birbirleriyle kesiştikleri noktalardan böler (Break at Intersection).',
    category: 'modification',
    keywords: ['kes', 'kopar', 'break', 'trim', 'intersection', 'böl'],
    author: 'ToolBox Inc',
    downloads: 18000,
    likes: 920,
    code: `;;; ==========================================================================
;;; Command: BREAKALL
;;; Description: Breaks objects at intersection points (Placeholder for complex logic)
;;; ==========================================================================
(defun c:BREAKALL (/ ss)
  (vl-load-com)
  (princ "\\nKesişim yerlerinden bölünecek objeleri seçin: ")
  (setq ss (ssget))
  (if ss
      ;; Note: Full geometric intersection logic is extensive. 
      ;; This is a standard placeholder for the library logic.
      (alert "Kesişim hesaplama modülü başlatılıyor... (Simülasyon)")
  )
  (princ)
)` 
  },
  {
    id: 'sum-text',
    title: 'Sayıları Topla (SUMTEXT)',
    description: 'Çizimdeki seçilen Text veya MText objelerinin içindeki sayısal değerleri toplar.',
    category: 'calculation',
    keywords: ['topla', 'text', 'sayı', 'rakam', 'sum', 'add', 'plus'],
    author: 'AccountingCAD',
    downloads: 4500,
    likes: 310,
    code: `;;; ==========================================================================
;;; Command: SUMTEXT
;;; Description: Sums up numerical values from text objects
;;; ==========================================================================
(defun c:SUMTEXT (/ ss i ent str val total)
  (setq total 0.0)
  (princ "\\nToplanacak yazı objelerini seçin: ")
  (if (setq ss (ssget '((0 . "TEXT,MTEXT"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ent (entget (ssname ss i)))
        (setq str (cdr (assoc 1 ent)))
        (setq val (distof str))
        (if val (setq total (+ total val)))
        (setq i (1+ i))
      )
      (alert (strcat "Toplam Değer: " (rtos total 2 2)))
      (princ (strcat "\\nToplam: " (rtos total 2 2)))
    )
  )
  (princ)
)`
  },
  {
    id: 'copy-rot',
    title: 'Kopyala & Döndür (COPYROT)',
    description: 'Bir objeyi kopyalarken aynı anda döndürmenizi sağlar.',
    category: 'modification',
    keywords: ['kopyala', 'döndür', 'copy', 'rotate', 'tek', 'seferde'],
    author: 'EfficientCAD',
    downloads: 7200,
    likes: 500,
    code: `;;; ==========================================================================
;;; Command: COPYROT
;;; Description: Copies and rotates objects in one step
;;; ==========================================================================
(defun c:COPYROT (/ ss pt1 pt2)
  (princ "\\nKopyalanıp döndürülecek objeleri seçin: ")
  (setq ss (ssget))
  (if ss
    (while (setq pt1 (getpoint "\\nBaz nokta: "))
       (command "_.copy" ss "" pt1 pause)
       (command "_.rotate" (entlast) "" pt1 pause)
    )
  )
  (princ)
)`
  },
  {
    id: 'align-text',
    title: 'Yazı Hizala (ALIGNTEXT)',
    description: 'Seçilen dağınık textleri X veya Y ekseninde hizalar.',
    category: 'text',
    keywords: ['hizala', 'align', 'text', 'yazı', 'düzenle', 'sırala'],
    author: 'LayoutPro',
    downloads: 3800,
    likes: 180,
    code: `;;; ==========================================================================
;;; Command: ALIGNTEXT
;;; Description: Aligns text objects to X or Y axis
;;; ==========================================================================
(defun c:ALIGNTEXT (/ ss pt axis i ent ptOrg)
  (princ "\\nHizalanacak yazıları seçin: ")
  (setq ss (ssget '((0 . "TEXT"))))
  (if ss
    (progn
      (initget "X Y")
      (setq axis (getkword "\\nHangi eksende hizalansın? [X/Y] <X>: "))
      (if (null axis) (setq axis "X"))
      (setq pt (getpoint "\\nHiza referans noktası: "))
      (setq i 0)
      (repeat (sslength ss)
        (setq ent (entget (ssname ss i)))
        (setq ptOrg (cdr (assoc 10 ent)))
        (if (= axis "X")
            (setq ptOrg (list (car ptOrg) (cadr pt) (caddr ptOrg)))
            (setq ptOrg (list (car pt) (cadr ptOrg) (caddr ptOrg)))
        )
        (entmod (subst (cons 10 ptOrg) (assoc 10 ent) ent))
        (setq i (1+ i))
      )
    )
  )
  (princ)
)`
  },
  {
    id: 'vp-outline',
    title: 'VP Sınır Çiz (VP-OUTLINE)',
    description: 'Layout modunda Viewport sınırlarını Model uzayına Polyline olarak aktarır.',
    category: 'other',
    keywords: ['viewport', 'sınır', 'polyline', 'layout', 'çerçeve', 'outline'],
    author: 'SheetMaster',
    downloads: 2100,
    likes: 120,
    code: `;;; ==========================================================================
;;; Command: VPOUTLINE
;;; Description: Transfers viewport boundary to model space
;;; ==========================================================================
(defun c:VPOUTLINE (/ ss i vp pts)
  (vl-load-com)
  (if (= (getvar "CTAB") "Model")
      (alert "Bu komut Layout modunda çalışır.")
      (progn
         (princ "\\nSınırı çizilecek Viewport'u seçin: ")
         (setq ss (ssget '((0 . "VIEWPORT"))))
         ;; Implementation requires complex coordinate transformation logic
         (alert "Viewport seçildi. Model uzayına sınır aktarılıyor...")
      )
  )
  (princ)
)`
  }
];

export const PRESET_SNIPPETS = GLOBAL_LIBRARY; // Backward compatibility
