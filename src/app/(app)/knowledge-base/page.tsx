"use client";

import { useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Wifi,
  Smartphone,
  Globe,
  ExternalLink,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

type ProductCategory = "eSIM" | "Travel WiFi" | "Sapphire Hotspot";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  coverage: string;
  dataAllowance: string;
  duration: string;
  price: string;
}

const mockProducts: Product[] = [
  {
    id: "prod-001",
    sku: "ESIM-EU-30",
    name: "eSIM Europe 30-Day",
    category: "eSIM",
    description: "30-day unlimited data eSIM covering 36 European countries.",
    imageUrl: "",
    coverage: "36 EU Countries",
    dataAllowance: "Unlimited",
    duration: "30 days",
    price: "$29.99",
  },
  {
    id: "prod-002",
    sku: "ESIM-ASIA-14",
    name: "eSIM Asia 14-Day",
    category: "eSIM",
    description: "14-day eSIM with 10GB data covering 12 Asian countries.",
    imageUrl: "",
    coverage: "12 Asian Countries",
    dataAllowance: "10 GB",
    duration: "14 days",
    price: "$19.99",
  },
  {
    id: "prod-003",
    sku: "ESIM-US-7",
    name: "eSIM USA 7-Day",
    category: "eSIM",
    description: "7-day eSIM with 5GB high-speed data in the USA.",
    imageUrl: "",
    coverage: "USA Nationwide",
    dataAllowance: "5 GB",
    duration: "7 days",
    price: "$14.99",
  },
  {
    id: "prod-004",
    sku: "TWF-PRO-01",
    name: "Travel WiFi Pro",
    category: "Travel WiFi",
    description: "Premium portable WiFi hotspot with 4G LTE. Up to 10 devices. Includes return shipping.",
    imageUrl: "",
    coverage: "Global (140+ countries)",
    dataAllowance: "Unlimited (Fair Use 1GB/day)",
    duration: "Rental",
    price: "$89.99",
  },
  {
    id: "prod-005",
    sku: "TWF-STD-01",
    name: "Travel WiFi Standard",
    category: "Travel WiFi",
    description: "Reliable portable WiFi for travelers. Connects up to 5 devices simultaneously.",
    imageUrl: "",
    coverage: "Global (100+ countries)",
    dataAllowance: "500 MB/day",
    duration: "Rental",
    price: "$59.99",
  },
  {
    id: "prod-006",
    sku: "TWF-LITE-01",
    name: "Travel WiFi Lite",
    category: "Travel WiFi",
    description: "Budget-friendly portable WiFi option. Great for light browsing and messaging.",
    imageUrl: "",
    coverage: "Global (80+ countries)",
    dataAllowance: "250 MB/day",
    duration: "Rental",
    price: "$39.99",
  },
  {
    id: "prod-007",
    sku: "SAP-HS-01",
    name: "Sapphire Hotspot X1",
    category: "Sapphire Hotspot",
    description: "Premium 5G-capable hotspot device for purchase. Battery lasts 12 hours.",
    imageUrl: "",
    coverage: "Global (150+ countries)",
    dataAllowance: "Plan-based",
    duration: "Purchase",
    price: "$149.99",
  },
  {
    id: "prod-008",
    sku: "SAP-HS-02",
    name: "Sapphire Hotspot Mini",
    category: "Sapphire Hotspot",
    description: "Compact 4G hotspot device. Credit card sized. 8 hour battery.",
    imageUrl: "",
    coverage: "Global (120+ countries)",
    dataAllowance: "Plan-based",
    duration: "Purchase",
    price: "$99.99",
  },
];

const categoryIcons: Record<ProductCategory, React.ElementType> = {
  eSIM: Globe,
  "Travel WiFi": Wifi,
  "Sapphire Hotspot": Smartphone,
};

const categoryColors: Record<ProductCategory, string> = {
  eSIM: "bg-lavender/20 text-amethyst",
  "Travel WiFi": "bg-success-soft text-success",
  "Sapphire Hotspot": "bg-fraud-yellow-soft text-fraud-yellow",
};

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    ProductCategory | "all"
  >("all");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = mockProducts.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-[540] text-charcoal">
            Knowledge Base
          </h1>
          <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
            Product catalog and reference information
          </p>
        </div>
        <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
          <DialogTrigger
            render={
              <Button className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add a new product to the knowledge base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Product Name
                </label>
                <Input placeholder="e.g. eSIM Global 90-Day" className="mt-1.5 rounded-[8px]" />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">SKU</label>
                <Input placeholder="e.g. ESIM-GLB-90" className="mt-1.5 rounded-[8px]" />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Category
                </label>
                <Input placeholder="eSIM / Travel WiFi / Sapphire Hotspot" className="mt-1.5 rounded-[8px]" />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Price
                </label>
                <Input placeholder="$0.00" className="mt-1.5 rounded-[8px]" />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setShowAddProduct(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
                onClick={() => setShowAddProduct(false)}
              >
                Add Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, SKUs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-[8px]"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-muted p-0.5">
          {(
            ["all", "eSIM", "Travel WiFi", "Sapphire Hotspot"] as const
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? "bg-white text-charcoal shadow-sm"
                  : "text-muted-foreground hover:text-charcoal"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => {
          const Icon = categoryIcons[product.category];
          return (
            <Card
              key={product.id}
              className="rounded-[16px] transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => setSelectedProduct(product)}
            >
              {/* Image placeholder */}
              <div className="flex h-40 items-center justify-center rounded-t-[16px] bg-gradient-to-br from-lavender/10 to-cream/40">
                <Icon className="h-12 w-12 text-amethyst/40" strokeWidth={1.2} />
              </div>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-[600] ${
                      categoryColors[product.category]
                    }`}
                  >
                    {product.category}
                  </span>
                  <span className="text-[11px] font-[460] text-muted-foreground font-mono">
                    {product.sku}
                  </span>
                </div>
                <h3 className="text-[15px] font-[600] text-charcoal">
                  {product.name}
                </h3>
                <p className="text-[13px] font-[460] text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[16px] font-[700] text-charcoal">
                    {product.price}
                  </span>
                  <span className="text-[12px] font-[460] text-muted-foreground">
                    {product.duration}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-[14px] font-[540] text-muted-foreground">
            No products found
          </p>
          <p className="text-[13px] font-[460] text-muted-foreground/70">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* Product Detail Dialog */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
      >
        {selectedProduct && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedProduct.name}</DialogTitle>
              <DialogDescription>
                {selectedProduct.sku} - {selectedProduct.category}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex h-32 items-center justify-center rounded-[8px] bg-gradient-to-br from-lavender/10 to-cream/40">
                {(() => {
                  const Icon = categoryIcons[selectedProduct.category];
                  return (
                    <Icon
                      className="h-10 w-10 text-amethyst/40"
                      strokeWidth={1.2}
                    />
                  );
                })()}
              </div>
              <p className="text-[13px] font-[460] text-muted-foreground">
                {selectedProduct.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Coverage", value: selectedProduct.coverage },
                  { label: "Data", value: selectedProduct.dataAllowance },
                  { label: "Duration", value: selectedProduct.duration },
                  { label: "Price", value: selectedProduct.price },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[8px] bg-muted/50 p-2.5"
                  >
                    <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[13px] font-[540] text-charcoal">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setSelectedProduct(null)}
              >
                Close
              </Button>
              <Button className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]">
                Edit Product
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
