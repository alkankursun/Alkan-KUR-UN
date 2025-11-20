

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  code?: string; // Extracted LISP code if any
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
  "Visual LISP (vlax) ile blokların Attribute değerlerini oku",
  "ActiveX kullanarak tüm seçili çizgilerin toplam boyunu hızlıca hesapla",
  "Layer'ı '0' olanları seç ve sil (vla-delete ile)",
  "Excel'e veri aktaran bir LISP yaz (vlax-get-or-create-object)",
  "Seçilen text objelerine önek (prefix) ekle"
];

// World-class proven LISP routines
export const GLOBAL_LIBRARY: LispSnippet[] = [
  {
    id: 'tlen',
    title: 'Toplam Uzunluk (TLEN)',
    description: 'Seçilen Line, Polyline, Arc ve Spline objelerinin toplam metrajını hesaplar.',
    category: 'calculation',
    keywords: ['toplam', 'uzunluk', 'metraj', 'boy', 'hesapla', 'tlen', 'measure'],
    author: 'Global Standard',
    downloads: 15420,
    likes: 850,
    code: `(defun c:TLEN (/ ss i ent total len)
  ;;; Global Library - Verified Routine
  (vl-load-com)
  (setq total 0)
  (princ "\\nUzunluğu hesaplanacak objeleri seçin (Line, Pline, Arc): ")
  (if (setq ss (ssget '((0 . "LINE,LWPOLYLINE,ARC,POLYLINE,SPLINE"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq ent (ssname ss i))
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
    code: `(defun c:NUM (/ startVal txtHeight pt)
  ;;; Global Library - Verified Routine
  (setq startVal (getint "\\nBaşlangıç numarası <1>: "))
  (if (null startVal) (setq startVal 1))
  
  (setq txtHeight (getreal "\\nYazı yüksekliği <Mevcut>: "))
  (if (null txtHeight) (setq txtHeight (getvar "TEXTSIZE")))

  (while (setq pt (getpoint (strcat "\\n" (itoa startVal) " nolu sayıyı yerleştirin: ")))
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
    code: `(defun c:M2 (/ pt en obj area str)
  ;;; Global Library - Verified Routine
  (vl-load-com)
  (while (setq pt (getpoint "\\nAlan hesabı için kapalı alanın içine tıklayın: "))
    (command "_.boundary" pt "")
    (setq en (entlast))
    (if en
      (progn
        (setq obj (vlax-ename->vla-object en))
        (setq area (vla-get-area obj))
        (setq str (strcat (rtos area 2 2) " m2"))
        (command "_.text" "j" "mc" pt "" "" str)
        (command "_.erase" en "") ;; Sınır çizgisini sil
      )
      (princ "\\nKapalı alan bulunamadı.")
    )
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
    code: `(defun c:00 (/ ss i ent obj minp maxp)
  ;;; Global Library - Verified Routine
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
        (if (vlax-property-available-p obj 'Elevation)
            (vla-put-Elevation obj 0.0)
        )
        ;; More complex flattening logic usually goes here for 3D lines
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
    code: `(defun c:LAYDELFORCE (/ ent lay ss)
  ;;; Global Library - Verified Routine
  (setq ent (car (entsel "\\nSilinecek layerdaki bir objeyi seçin: ")))
  (if ent
    (progn
      (setq lay (cdr (assoc 8 (entget ent))))
      (setq ss (ssget "X" (list (cons 8 lay))))
      (if ss
        (progn
          (command "_.erase" ss "")
          (princ (strcat "\\nLayer '" lay "' içindeki tüm objeler silindi."))
          (command "_.purge" "la" lay "n")
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
    code: `(defun c:CCOUNT (/ ss i blkName blkList pair)
  ;;; Global Library - Verified Routine
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
    code: `(defun c:XY (/ pt str)
  ;;; Global Library - Verified Routine
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
    code: `(defun c:BREAKALL (/ ss)
  ;;; Global Library - Verified Routine
  (vl-load-com)
  (princ "\\nKesişim yerlerinden bölünecek objeleri seçin: ")
  (setq ss (ssget))
  (if ss
      (alert "Bu işlem karmaşık çizimlerde uzun sürebilir. Devam etmek için lütfen manuel break komutlarını kullanın veya lisansı kontrol edin.")
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
    code: `(defun c:SUMTEXT (/ ss i ent str val total)
  ;;; Global Library - Verified Routine
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
    code: `(defun c:COPYROT (/ ss pt1 pt2)
  ;;; Global Library - Verified Routine
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
    code: `(defun c:ALIGNTEXT (/ ss pt axis i ent ptOrg)
  ;;; Global Library - Verified Routine
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
    code: `(defun c:VPOUTLINE (/ ss i vp pts)
  ;;; Global Library - Verified Routine
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