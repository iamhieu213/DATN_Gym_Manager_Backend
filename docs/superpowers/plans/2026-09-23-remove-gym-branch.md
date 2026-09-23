---
title: Bỏ tính năng đa chi nhánh (GymBranch) — chuyển về 1 phòng tập
status: Đã lập kế hoạch
created_date: 2026-09-23
started_date:
completed_date:
cancel_reason:
owner: hieunv
related_spec:
---

# Bỏ tính năng đa chi nhánh (GymBranch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ bỏ hoàn toàn model `GymBranch` và mọi field/logic `branchId` khỏi backend, để hệ thống chỉ phục vụ **một phòng tập duy nhất**.

**Architecture:** Làm theo thứ tự "code trước — DB sau". Khi schema vẫn còn `branchId`, việc *bỏ bớt* chỗ dùng `branchId` trong code vẫn compile được, nên mỗi task sửa một module và kiểm chứng bằng `tsc` riêng. Sau khi toàn bộ `src/` sạch branch, mới xoá model trong `schema.prisma`, sinh migration mới và sửa `seed.ts` trong cùng một task (vì `seed.ts` cũng được `tsc` kiểm tra). Migration cũ giữ nguyên để không phá lịch sử.

**Tech Stack:** Node.js + Express 5, TypeScript 6 (strict, `exactOptionalPropertyTypes`), Prisma 7 + PostgreSQL 15, Redis, JWT.

**Spec:** Không có spec riêng — yêu cầu từ user: "bỏ phần chi nhánh, chỉ có 1 phòng tập, sửa từng module và DB tương ứng".

## Global Constraints

- Quy tắc phân quyền theo **role** giữ nguyên (ADMIN / STAFF / COACH / USER). Chỉ bỏ phần phân quyền theo **chi nhánh**.
- Sau refactor: STAFF thấy **toàn bộ** dữ liệu phòng tập ở các API trước đây bị lọc theo chi nhánh (giống ADMIN về phạm vi dữ liệu, nhưng vẫn giữ các giới hạn theo role hiện có).
- Không sửa các file migration cũ trong `prisma/migrations/`. Chỉ thêm migration mới.
- Không thêm test framework (dự án chưa có; `npm test` chỉ là placeholder). Kiểm chứng bằng `npx tsc --noEmit`, `grep`, và gọi API thủ công.
- Không sửa logic ngoài phạm vi branch (kể cả khi thấy bug khác — ghi chú lại, xem mục "Ngoài phạm vi").
- Cuối cùng: `grep -rniE "branch" src prisma/schema.prisma prisma/seed.ts` phải **không còn kết quả**.

## Review Focus

1. **Client cũ vẫn gửi `branchId`** (body check-in, body tạo/sửa user, body tạo thiết bị, query `?branchId=`) → phải được **bỏ qua im lặng**, không lỗi 400/500. Code hiện tại build object `data` tường minh nên field thừa bị bỏ qua — kiểm tra bằng smoke test ở Task 10.
2. **ADMIN check-in không gửi `branchId`** → trước đây lỗi `ADMIN_MUST_SPECIFY_BRANCH`, giờ phải thành công 200.
3. **STAFF không có chi nhánh** (trước đây lỗi `STAFF_BRANCH_REQUIRED` ở payments, coach, pt-booking, equipment stats) → giờ phải trả 200 với toàn bộ dữ liệu.
4. **JWT cũ còn chứa `branchId`** (user đang đăng nhập lúc deploy) → `verifyAccessToken` phải vẫn chấp nhận token (chỉ bỏ qua field thừa), không bắt user login lại.
5. **Response API `/users` không còn `branchId`/`branch`** → breaking change cho frontend; phải báo team FE (ghi trong commit message và docs).

## Ngoài phạm vi (phát hiện khi đọc code — KHÔNG sửa trong plan này)

- `MembershipService.confirmPayment` chỉ cho `ADMIN`/`STAFF`, nhưng callback VNPAY gọi với role `"SYSTEM"` ([payment.controller.ts:118,144](../../../src/modules/payment/payment.controller.ts)) → thanh toán VNPAY cho gói membership sẽ bị `FORBIDDEN`. Bug có sẵn, nên xử lý ở task riêng.
- Module `dashboard` không dùng branch → không cần sửa.

## File Structure

| File | Hành động |
|---|---|
| `src/modules/checkin/checkin.{controller,service,repository,dto}.ts` | Sửa |
| `src/modules/equipment/equipment.{controller,service,repository,dto}.ts` | Sửa |
| `src/modules/coach/coach.{controller,service,dto}.ts` | Sửa |
| `src/modules/payment/payment.{controller,service,dto}.ts` | Sửa |
| `src/modules/membership/membership.{service,repository}.ts` | Sửa |
| `src/modules/pt-booking/pt-booking.{controller,service,repository}.ts` | Sửa |
| `src/modules/user/user.{controller,service,repository,dto}.ts` | Sửa |
| `src/services/event.service.ts` | Sửa |
| `src/modules/auth/auth.service.ts`, `src/utils/jwt.ts`, `src/middleware/auth.middleware.ts` | Sửa |
| `src/modules/branch/` (5 file) | **Xoá** |
| `src/app.ts` | Sửa (bỏ route `/branch`) |
| `prisma/schema.prisma` | Sửa |
| `prisma/migrations/<timestamp>_remove_gym_branch/migration.sql` | Tạo (do Prisma sinh) |
| `prisma/seed.ts` | Sửa |
| `docs/branch.md` | **Xoá** |
| `docs/{README,check-in,equipment,coach,payments,pt-booking,users}.md` | Sửa |

---

### Task 0: Chuẩn bị môi trường & baseline

**Files:** không sửa code.

- [ ] **Step 1: Tạo nhánh làm việc**

```bash
git checkout -b refactor/remove-gym-branch
```

- [ ] **Step 2: Cài dependency và tạo `.env`** (repo hiện chưa có `node_modules` và `.env`)

```bash
npm install
```

Tạo file `.env` (nếu chưa có) với tối thiểu:

```env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/gym_db"
JWT_ACCESS_SECRET="dev-access-secret"
JWT_REFRESH_SECRET="dev-refresh-secret"
```

(Các biến khác như Redis/Cloudinary/VNPAY lấy từ `.env` của team.)

- [ ] **Step 3: Chạy Postgres + Redis và generate Prisma client**

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma generate
```

Expected: migrate áp dụng đủ 22 migration, generate thành công.

- [ ] **Step 4: Ghi baseline lỗi TypeScript**

```bash
npx tsc --noEmit -p . > /tmp/tsc-baseline.txt 2>&1; echo "exit=$?"; wc -l /tmp/tsc-baseline.txt
```

Ghi lại số dòng lỗi. Mọi task sau: **không được tạo thêm lỗi mới** so với baseline (lỗi có sẵn không phải trách nhiệm plan này).

- [ ] **Step 5: Ghi baseline số chỗ dùng branch**

```bash
grep -rniE "branch" src prisma/schema.prisma prisma/seed.ts | wc -l
```

Expected: khoảng 280+ dòng. Con số phải giảm dần sau mỗi task và về 0 ở cuối.

---

### Task 1: Module Check-in

**Files:**
- Modify: `src/modules/checkin/checkin.dto.ts`
- Modify: `src/modules/checkin/checkin.repository.ts:27-32`
- Modify: `src/modules/checkin/checkin.service.ts:9,51,84-97`
- Modify: `src/modules/checkin/checkin.controller.ts:22-23,42-45,57,72-87,138-140`

**Interfaces:**
- Produces: `CheckInService.checkIn(phone: string)`, `CheckInService.getAllHistory(role: string, query: ListCheckInQueryDto)`, `CheckInRepository.createCheckIn(userId: number)`

- [ ] **Step 1: Sửa DTO** — `checkin.dto.ts` thành:

```ts
export interface CheckInDto {
    phone: string;
}

export interface ListCheckInQueryDto {
    search? : string;
    page? : string;
    limit? : string;
}
```

- [ ] **Step 2: Sửa repository** — `createCheckIn`:

```ts
    async createCheckIn(userId : number) {
         return this.prisma.checkIn.create({
            data : {
                userId : userId,
            },
```

(giữ nguyên phần `include` phía sau)

- [ ] **Step 3: Sửa service**

Dòng 9: `public async checkIn(phone: string) {`
Dòng 51: `const checkInRecord = await this.checkInRepository.createCheckIn(userId);`
Hàm `getAllHistory`: đổi chữ ký và xoá khối lọc branch:

```ts
    public async getAllHistory(role: string, query: ListCheckInQueryDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error("FORBIDDEN");
        }
```

Xoá toàn bộ khối:

```ts
        if(role === 'STAFF'){
            where.branchId = actorBranchId ?? undefined;
        } else if(role === 'ADMIN' && query.branchId) {
            where.branchId = Number(query.branchId);
        }
```

- [ ] **Step 4: Sửa controller**

Trong `mapErrorStatus` và `mapErrorMessage`: xoá các `case "STAFF_BRANCH_REQUIRED":` và `case "ADMIN_MUST_SPECIFY_BRANCH":` (kể cả câu `return` message tương ứng ở dòng 43, 45).

Trong `checkInByPhone`: xoá dòng `const staffBranchId = user.branchId;`, xoá toàn bộ khối `// LẤY VÀ KIỂM TRA BRANCHID CHO LƯỢT CHECK-IN` (dòng 72-85), đổi lời gọi thành:

```ts
        const result = await checkInService.checkIn(phone);
```

Trong `getAllHistory`: xoá `const branchId = user.branchId;` và đổi lời gọi:

```ts
        const result = await checkInService.getAllHistory(role, req.query as ListCheckInQueryDto);
```

- [ ] **Step 5: Kiểm chứng**

```bash
grep -niE "branch" src/modules/checkin/*.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Expected: `grep` không in gì; `diff` không có dòng lỗi mới liên quan `checkin`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/checkin
git commit -m "refactor(checkin): bỏ phân chia theo chi nhánh"
```

---

### Task 2: Module Equipment

**Files:**
- Modify: `src/modules/equipment/equipment.dto.ts:9,34`
- Modify: `src/modules/equipment/equipment.repository.ts:98-101`
- Modify: `src/modules/equipment/equipment.service.ts` (nhiều hàm)
- Modify: `src/modules/equipment/equipment.controller.ts:42-161`

**Interfaces:**
- Produces:
  - `getEquipmentSummary(query: { search?: string })`
  - `getEquipmentGroupDetails(role: string, name: string | undefined, query: ListQueryEquipmentDetailDto)`
  - `updateEquipment(role: string, id: number, dto: UpdateEquipmentDto)`
  - `bulkUpdateEquipment(role: string, dto: BulkUpdateEquipmentDto)`
  - `deleteEquipment(role: string, id: number)`
  - `getEquipmentStats(role: string)`
  - `getMaintenanceTasks(month?: number, year?: number)`
  - `EquipmentRepository.getStatsSummary()`

- [ ] **Step 1: DTO** — xoá `branchId: number;` trong `CreateEquipmentDto` và `branchId? : string;` trong `ListQueryEquipmentDetailDto`.

- [ ] **Step 2: Repository** — `getStatsSummary`:

```ts
    public async getStatsSummary() {
        return this.prisma.equipment.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });
    }
```

- [ ] **Step 3: Service — `createEquipment`**

```ts
        const { name, baseCode, quantity, purchaseDate, note } = dto;
        if (quantity <= 0) {
```

(xoá dòng `if (!branchId) throw new Error('BAD_REQUEST');`) và trong `newEquipments.push({...})` xoá dòng `branchId: branchId`.

- [ ] **Step 4: Service — `getEquipmentSummary`**

```ts
    public async getEquipmentSummary(query: { search?: string }) {
        const where: any = {};

        if (query.search) {
```

(xoá khối `let targetBranchId ... if (targetBranchId) { where.branchId = targetBranchId; }`)

- [ ] **Step 5: Service — `getEquipmentGroupDetails`**

Chữ ký: `public async getEquipmentGroupDetails(role: string, name: string | undefined, query: ListQueryEquipmentDetailDto) {`
Xoá khối từ `let targetBranchId: number | null = null;` đến hết `if (targetBranchId) { where.branchId = targetBranchId; }`.

- [ ] **Step 6: Service — `updateEquipment`, `bulkUpdateEquipment`, `deleteEquipment`**

```ts
    public async updateEquipment(role: string, id: number, dto: UpdateEquipmentDto) {
```
Xoá khối `//Chan staff sua thiet bi chi nhanh khac` + `if (role === 'STAFF' && existing.branchId !== actorBranchId) {...}`.

```ts
    public async bulkUpdateEquipment(role: string, dto: BulkUpdateEquipmentDto) {
```
Xoá khối `if (role === 'STAFF') { const equipments = ...; const hasInvalid = ...; if (hasInvalid) throw ... }`.

```ts
    public async deleteEquipment(role: string, id: number) {
```
Xoá khối `// Chặn STAFF xóa thiết bị chi nhánh khác` + `if (role === 'STAFF' && equipment.branchId !== actorBranchId) {...}`.

- [ ] **Step 7: Service — `getEquipmentStats`, `getMaintenanceTasks`**

```ts
    public async getEquipmentStats(role: string) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }
        const rawStats = await this.repository.getStatsSummary();
```
(xoá khối `let targetBranchId ...` ở giữa)

```ts
    public async getMaintenanceTasks(month?: number, year?: number) {
        const where: any = {};

        // Nếu có lọc theo tháng/năm
```
(xoá khối `let targetBranchId ...` và `if (targetBranchId) { where.equipment = {...} }`)

- [ ] **Step 8: Controller**

```ts
// getEquipmentSummary
        const search = req.query.search as string;
        const data = await service.getEquipmentSummary({ search });
```
(xoá `role`, `actorBranchId`, `branchId` không còn dùng; `role` trong hàm này chỉ dùng cho service nên xoá luôn)

```ts
// getEquipmentGroupDetails — xoá dòng actorBranchId
        const result = await service.getEquipmentGroupDetails(role, name, query);

// updateEquipment
        const data = await service.updateEquipment(role, id, req.body);

// bulkUpdateEquipment
        const count = await service.bulkUpdateEquipment(role, req.body);

// deleteEquipment
        await service.deleteEquipment(role, id);

// getEquipmentStats — xoá dòng queryBranchId
        const data = await service.getEquipmentStats(role);

// getMaintenanceTasks — xoá dòng queryBranchId
        const data = await service.getMaintenanceTasks(month, year);
```

Lưu ý: trong `getMaintenanceTasks` controller vẫn giữ `const role = req.user?.role; if (!role) throw new Error('FORBIDDEN');` để giữ hành vi bắt buộc đăng nhập.

- [ ] **Step 9: Kiểm chứng**

```bash
grep -niE "branch" src/modules/equipment/*.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Expected: grep rỗng, không lỗi mới.

- [ ] **Step 10: Commit**

```bash
git add src/modules/equipment
git commit -m "refactor(equipment): bỏ phân chia thiết bị/bảo trì theo chi nhánh"
```

---

### Task 3: Module Coach

**Files:**
- Modify: `src/modules/coach/coach.dto.ts:24,32`
- Modify: `src/modules/coach/coach.service.ts:79-84,163-191`
- Modify: `src/modules/coach/coach.controller.ts:77-81`

**Interfaces:**
- Produces: `CoachService.getAllCoachesForAdmin(role: string, query: ListCoachAdminQueryDto)`

- [ ] **Step 1: DTO** — xoá `branchId? : string; //Loc PT theo chi nhanh` và `branchId? : string;` ở `ListCoachAdminQueryDto`.

- [ ] **Step 2: Service — danh sách PT public (dòng 79-84)** thay bằng:

```ts
        //3. tim kiem theo name
        if (query.search) {
            where.user = {
                name: { contains: query.search, mode: 'insensitive' }
            };
        }
```

- [ ] **Step 3: Service — `getAllCoachesForAdmin`**

```ts
    public async getAllCoachesForAdmin(role: string, query: ListCoachAdminQueryDto) {
```

Xoá khối `//PHAN QUYEN THEO CHI NHANH` (dòng 176-184) và thay khối `if (query.search || targetBranchId) {...}` bằng:

```ts
        if (query.search) {
            where.user = {
                name: { contains: query.search, mode: 'insensitive' }
            };
        }
```

- [ ] **Step 4: Controller `getCoachesForAdmin`** — xoá `const actorBranchId = req.user?.branchId;`, đổi lời gọi:

```ts
        const result = await coachService.getAllCoachesForAdmin(role, queryParams);
```

- [ ] **Step 5: Kiểm chứng**

```bash
grep -niE "branch" src/modules/coach/*.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/coach
git commit -m "refactor(coach): bỏ lọc PT theo chi nhánh"
```

---

### Task 4: Luồng thanh toán — Payment + Membership + PT-booking

Ba module này gắn với nhau qua chữ ký `confirmPayment(...)` nên phải sửa trong cùng một task để `tsc` xanh.

**Files:**
- Modify: `src/modules/membership/membership.repository.ts:144-153`
- Modify: `src/modules/membership/membership.service.ts:129,148`
- Modify: `src/modules/pt-booking/pt-booking.repository.ts:111-120,251-302,450`
- Modify: `src/modules/pt-booking/pt-booking.service.ts:84-89,116-123,312-350`
- Modify: `src/modules/pt-booking/pt-booking.controller.ts:193,222`
- Modify: `src/modules/payment/payment.dto.ts:12`
- Modify: `src/modules/payment/payment.service.ts:33-62,80-102,138-150`
- Modify: `src/modules/payment/payment.controller.ts:66-88,118,144,185,211`

**Interfaces:**
- Produces:
  - `MembershipRepository.activateMembershipPayment(paymentId: number, transactionRef: string, gatewayResponse: any)`
  - `MembershipService.confirmPayment(role: string, paymentId: number, transactionRef?: string, gatewayResponse?: any)`
  - `PtBookingRepository.activateAssignment(paymentId: number, transactionRef: string, durationDays: number, gatewayResponse?: any)`
  - `PtBookingRepository.executeCoachAndPackageChange(requestId: number, newSessions: number, newPricePaid: number, transactionRef?: string, gatewayResponse?: any)`
  - `PtBookingService.confirmPayment(role: string, paymentId: number, transactionRef?: string, gatewayResponse?: any)`
  - `PtBookingService.getChangeRequests(role: string, status?: string)`
  - `PtBookingService.adminGetAssignments(role: string, status?: string)`
  - `PaymentService.confirmPayment(role: string, paymentId: number, dto: { transactionRef: string; gatewayResponse?: any })`
  - `PaymentService.adminGetPayments(role: string, query: ListPaymentsQueryDto)`
  - `PaymentService.findPaymentById(userId: number, role: string, paymentId: number)`

- [ ] **Step 1: Membership repository**

```ts
    async activateMembershipPayment(paymentId: number, transactionRef: string, gatewayResponse: any) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    transaction_ref: transactionRef,
                    gateway_response: gatewayResponse,
                }
            });
```

- [ ] **Step 2: Membership service**

```ts
    public async confirmPayment(role: string, paymentId: number, transactionRef?: string, gatewayResponse?: any) {
```

và lời gọi repository:

```ts
            const { payment: updatedPayment, membership } = await this.repository.activateMembershipPayment(
                paymentId,
                transactionRef ?? `CASH_CONFIRMED_BY_${role}`,
                gatewayResponse ?? { confirmedBy: role }
            );
```

- [ ] **Step 3: PT-booking repository**

`activateAssignment`:

```ts
    public async activateAssignment(paymentId: number, transactionRef: string, durationDays: number, gatewayResponse?: any) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    transaction_ref: transactionRef,
                    gateway_response: gatewayResponse ?? null,
                }
            });
```

`executeCoachAndPackageChange`: xoá tham số cuối `actorBranchId?: number | null` và dòng `...(actorBranchId ? { branchId: actorBranchId } : {})` trong `tx.payment.update` (dòng ~302):

```ts
    public async executeCoachAndPackageChange(
        requestId: number,
        newSessions: number,
        newPricePaid: number,
        transactionRef: string = "UPGRADE_ACTIVE",
        gatewayResponse?: any
    ) {
```

`findAllAssignments` (dòng ~450): trong `coach.include.user.select` xoá `branchId : true`:

```ts
                        user: {
                            select: {
                                name: true,
                                phone: true
                            }
                        }
```

- [ ] **Step 4: PT-booking service**

```ts
    public async confirmPayment(
        role: string,
        paymentId: number,
        transactionRef: string = "CASH_PAYMENT",
        gatewayResponse?: any) {
```

Lời gọi ở dòng 116:

```ts
            resultAssignment = await this.repository.executeCoachAndPackageChange(
                changeRequest.id,
                newSessions,
                totalNewPrice,
                transactionRef,
                gatewayResponse
            );
```

```ts
    public async getChangeRequests(role: string, status?: string) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }

        const where: any = {};
        if (status) where.status = status;

        return this.repository.findChangeRequests(where);
    }
```

```ts
    public async adminGetAssignments(role: string, status?: string) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }

        const where: any = {};
        if (status) where.status = status;

        return this.repository.findAllAssignments(where);
    }
```

- [ ] **Step 5: PT-booking controller**

```ts
        const data = await service.getChangeRequests(role, status);
...
        const data = await service.adminGetAssignments(role, status);
```

- [ ] **Step 6: Payment DTO** — xoá `branchId? : string` khỏi `ListPaymentsQueryDto`.

- [ ] **Step 7: Payment service**

```ts
    public async confirmPayment(role: string,
        paymentId: number,
        dto: { transactionRef: string; gatewayResponse?: any }) {
        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_ALREADY_PROCESSED");

        if (payment.membership_id) {
            await this.membershipService.confirmPayment(role, paymentId, dto.transactionRef, dto.gatewayResponse);
        } else if (payment.coach_assignment_id) {
            await this.ptBookingService.confirmPayment(role, paymentId, dto.transactionRef, dto.gatewayResponse);
        } else {
            await this.repository.updatePayment(paymentId, {
                status: "PAID",
                paid_at: new Date(),
                transaction_ref: dto.transactionRef,
                gateway_response: dto.gatewayResponse,
            });
        }
```

(giữ nguyên phần phía sau: lấy lại payment và trả về)

```ts
    public async adminGetPayments(role: string, query: ListPaymentsQueryDto) {
```
Xoá khối `let targetBranchId ... if (targetBranchId) { where.branchId = targetBranchId; }` (dòng 92-102).

```ts
    public async findPaymentById(userId : number, role : string, paymentId : number) {
```
Xoá khối `// STAFF chỉ xem hóa đơn của chi nhánh mình` + `if (role === 'STAFF' && payment.branchId !== actorBranchId) {...}`.

- [ ] **Step 8: Payment controller**

`confirmCashPayment`:

```ts
export const confirmCashPayment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;

        if (!role) throw new Error("FORBIDDEN");

        const paymentId = parseInt(req.params.paymentId as string, 10);
        if (isNaN(paymentId)) {
            return res.status(400).json({ success: false, message: "Mã hóa đơn không hợp lệ." });
        }

        const confirmDto = {
            transactionRef: `CASH_CONFIRMED_BY_${role}`,
            gatewayResponse: { confirmedBy: role },
        };

        await service.confirmPayment(role, paymentId, confirmDto);
```

Hai callback VNPAY (dòng 118 và 144):

```ts
            await service.confirmPayment("SYSTEM", paymentId, { transactionRef: transactionNo, gatewayResponse: vnp_Params });
```

```ts
        const result = await service.adminGetPayments(role, query);
...
        const data = await service.findPaymentById(userId, role, paymentId);
```

- [ ] **Step 9: Kiểm chứng**

```bash
grep -niE "branch" src/modules/payment/*.ts src/modules/membership/*.ts src/modules/pt-booking/*.ts
grep -rn "confirmPayment(" src --include=*.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Expected: grep branch rỗng; mọi lời gọi `confirmPayment(` có đúng số tham số theo Interfaces ở trên; không lỗi mới.

- [ ] **Step 10: Commit**

```bash
git add src/modules/payment src/modules/membership src/modules/pt-booking
git commit -m "refactor(payment): bỏ ghi nhận/lọc hoá đơn và hợp đồng PT theo chi nhánh"
```

---

### Task 5: Module User

**Files:**
- Modify: `src/modules/user/user.dto.ts:9,27-28,66,79`
- Modify: `src/modules/user/user.repository.ts:18-25,39-60,125-136`
- Modify: `src/modules/user/user.service.ts:39-40,55-87,202-211,228,299-312,393-400`
- Modify: `src/modules/user/user.controller.ts:25,50-51,67,425`

**Interfaces:**
- Produces: `UserService.getAllUsers(actorRole: string, query: ListUserQueryDto)`, `UserService.getUserStats(actorRole: string)`, `UserRepository.getUserStats()`, `UserRepository.findManyPaginated(params: { skip; take; role?; status?; search? })`

- [ ] **Step 1: DTO** — xoá:
  - `branchId? : string;` trong `ListUserQueryDto`
  - `branchId: number | null;` và `branch?: { id : number, name : string, code : string } | null;` trong `UserListItemDto`
  - `branchId? : number;` trong `CreateUserDto` và `UpdateUserDto`

- [ ] **Step 2: Repository**

Trong `userListSelect` xoá `branchId: true,` và toàn bộ khối `branch: { select: {...} }` (object kết thúc bằng `updatedAt: true,`).

`findManyPaginated`: xoá `branchId?: number;` khỏi params, xoá dòng `if (params.branchId) where.branchId = params.branchId;` và khối `if (params.branchId) { where.AND = [...] }`.

`getUserStats`:

```ts
    public async getUserStats(): Promise<any> {
        ...
        const whereClause: Prisma.UserWhereInput = {
            status: { not: 'DELETED' },
        };
```

(xoá comment `// Tạo cấu trúc where lọc theo chi nhánh nếu có`)

- [ ] **Step 3: Service**

`mapRow`: xoá hai dòng `branchId: row.branchId,` và `branch: row.branch,`.

`getAllUsers`:

```ts
    public async getAllUsers(actorRole: string, query: ListUserQueryDto): Promise<PaginatedUserListDto> {
```
Xoá khối `let targetBranchId ...` (dòng 71-76) và dòng spread `...(targetBranchId !== undefined ? { branchId: targetBranchId } : {})`.

`createUser`: xoá toàn bộ từ `const targetRole = dto.role || UserRole.USER;` đến hết khối `finalBranchId` (dòng 200-211), và xoá dòng `...(finalBranchId ? { branch: { connect: { id: finalBranchId } } } : {}),` trong `userRepository.create(...)`. (Kiểm tra `targetRole` không còn được dùng ở chỗ khác trong hàm — trong code hiện tại chỉ dùng cho check branch.)

`updateUser`: xoá khối dòng 299-312:

```ts
        const targetRole = dto.role !== undefined ? dto.role : targetUser.role;
        const targetBranchId = dto.branchId !== undefined ? dto.branchId : targetUser.branchId;
        if ((targetRole === UserRole.STAFF || targetRole === UserRole.COACH) && !targetBranchId) {
            throw new Error("BRANCH_REQUIRED_FOR_STAFF_COACH");
        }
        if (dto.branchId !== undefined) {
            ...
        }
```

`getUserStats`:

```ts
    public async getUserStats(actorRole: string): Promise<UserStatsDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }
        return await this.userRepository.getUserStats();
    }
```

- [ ] **Step 4: Controller**

Xoá `case "BRANCH_REQUIRED_FOR_STAFF_COACH":` ở cả `mapErrorStatus` và `mapErrorMessage` (kèm `return` message dòng 51).

```ts
        const result = await userService.getAllUsers(req.user.role, req.query as ListUserQueryDto);
...
        const result = await userService.getUserStats(req.user.role);
```

- [ ] **Step 5: Kiểm chứng**

```bash
grep -niE "branch" src/modules/user/*.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Nếu `tsc` báo `targetUser` hoặc `targetRole` "declared but never read" — không phải lỗi (tsconfig không bật `noUnusedLocals`), nhưng nếu biến `targetUser` chỉ còn dùng cho check not-found thì giữ nguyên.

- [ ] **Step 6: Commit**

```bash
git add src/modules/user
git commit -m "refactor(user): bỏ gán/lọc người dùng theo chi nhánh

BREAKING: response /users không còn field branchId và branch."
```

---

### Task 6: Event service (thông báo)

**Files:**
- Modify: `src/services/event.service.ts:12-29,50,78,120,151,168,234`

**Interfaces:**
- Produces: `getStaffAndAdmins()` — trả về mọi user `ACTIVE` có role `ADMIN` hoặc `STAFF`.

- [ ] **Step 1: Sửa hàm tiện ích**

```ts
// Hàm tiện ích: Lấy toàn bộ ADMIN + STAFF đang hoạt động
async function getStaffAndAdmins() {
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { in: ['ADMIN', 'STAFF'] }
    }
  });
}
```

- [ ] **Step 2: Sửa 6 chỗ gọi** — mọi `getStaffAndAdmins(buyer?.branchId)`, `getStaffAndAdmins(payment.branchId)`, `getStaffAndAdmins(member?.branchId)` đổi thành:

```ts
    const staffs = await getStaffAndAdmins();
```

Sửa comment liên quan chi nhánh cho đúng nghĩa (ví dụ `// Thông báo cho tất cả Staff/Admin`). Nếu sau khi sửa, biến `buyer` hoặc `member` không còn được dùng trong handler thì **xoá luôn** câu `prisma.user.findUnique(...)` tương ứng để khỏi query thừa — kiểm tra từng handler (`buyer` ở handler `payment.success` vẫn có thể dùng ở chỗ khác, chỉ xoá khi thật sự không dùng).

- [ ] **Step 3: Kiểm chứng**

```bash
grep -niE "branch" src/services/event.service.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

- [ ] **Step 4: Commit**

```bash
git add src/services/event.service.ts
git commit -m "refactor(notification): gửi thông báo cho toàn bộ ADMIN/STAFF thay vì theo chi nhánh"
```

---

### Task 7: Auth, JWT, middleware

Làm sau Task 1-6 vì trước đó các module còn đọc `req.user.branchId`.

**Files:**
- Modify: `src/utils/jwt.ts:8,57`
- Modify: `src/middleware/auth.middleware.ts:8`
- Modify: `src/modules/auth/auth.service.ts:216,250,258,391,393`

**Interfaces:**
- Produces: `AccessTokenPayload = { userId: number; role: UserRole }`; `AuthRequest.user = { userId: number; role: string }`

- [ ] **Step 1: jwt.ts**

```ts
export interface AccessTokenPayload {
  userId: number;
  role: UserRole;
}
```

```ts
  return {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };
```

(Token cũ vẫn chứa `branchId` sẽ được verify bình thường, field thừa bị bỏ qua — thoả Review Focus #4.)

- [ ] **Step 2: auth.middleware.ts**

```ts
export interface AuthRequest extends Request {
    user?: {
        userId: number;
        role: string;
    }
}
```

- [ ] **Step 3: auth.service.ts**

Dòng 213-217:
```ts
        const accessToken = signAccessToken({
            userId: user.id,
            role: user.role,
        });
```

Dòng 250: `select: { role: true },`

Dòng 255-259:
```ts
        const accessToken = signAccessToken({
            userId,
            role: user.role,
        });
```

Dòng 388-393:
```ts
    private async issuseAuthTokensForUser(user: {
        id: number;
        role: import('@prisma/client').UserRole;
    }): Promise<{ accessToken: string, refreshToken: string }> {
        const accessToken = signAccessToken({ userId: user.id, role: user.role });
```

- [ ] **Step 4: Kiểm chứng**

```bash
grep -rniE "branch" src --include=*.ts | grep -v "^src/modules/branch/" | grep -v "^src/app.ts"
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Expected: grep rỗng (chỉ còn module `branch` và `app.ts`); không lỗi mới.

- [ ] **Step 5: Commit**

```bash
git add src/utils/jwt.ts src/middleware/auth.middleware.ts src/modules/auth/auth.service.ts
git commit -m "refactor(auth): bỏ branchId khỏi JWT payload"
```

---

### Task 8: Xoá module Branch

**Files:**
- Delete: `src/modules/branch/branch.controller.ts`, `branch.repository.ts`, `branch.dto.ts`, `branch.service.ts`, `branch.route.ts`
- Modify: `src/app.ts:14,51`

- [ ] **Step 1: Xoá thư mục**

```bash
git rm -r src/modules/branch
```

- [ ] **Step 2: Sửa `app.ts`** — xoá dòng import `import branchRoutes from './modules/branch/branch.route'` và dòng `app.use("/branch", branchRoutes);`.

- [ ] **Step 3: Kiểm chứng**

```bash
grep -rniE "branch" src
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
```

Expected: `grep` **rỗng hoàn toàn**; không lỗi mới.

- [ ] **Step 4: Commit**

```bash
git add src/app.ts
git commit -m "refactor: xoá module branch và route /branch"
```

---

### Task 9: Database — schema, migration, seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_remove_gym_branch/migration.sql` (Prisma sinh)
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Sửa `schema.prisma`** — xoá các cặp dòng sau:

Trong `model User`:
```prisma
  branchId Int?       @map("branch_id")
  branch   GymBranch? @relation(fields: [branchId], references: [id], onDelete: SetNull)
```

Trong `model Payment`:
```prisma
  branchId Int?       @map("branch_id")
  branch   GymBranch? @relation(fields: [branchId], references: [id], onDelete: SetNull)
```

Trong `model CheckIn`:
```prisma
  branchId Int       @map("branch_id")
  branch   GymBranch @relation(fields: [branchId], references: [id], onDelete: Restrict)
```

Trong `model GroupClass`:
```prisma
  branchId Int       @map("branch_id")
  branch   GymBranch @relation(fields: [branchId], references: [id], onDelete: Restrict)
```

Trong `model Equipment`:
```prisma
  branchId Int       @map("branch_id")
  branch   GymBranch @relation(fields: [branchId], references: [id], onDelete: Cascade)
```

Xoá toàn bộ `model GymBranch { ... }` (dòng 465-483).

- [ ] **Step 2: Validate schema**

```bash
npx prisma validate
npx prisma format
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Sinh migration (chưa áp dụng) để review SQL**

```bash
npx prisma migrate dev --name remove_gym_branch --create-only
```

Mở file `prisma/migrations/*_remove_gym_branch/migration.sql` vừa sinh. Expected nội dung tương đương:

```sql
-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_branch_id_fkey";
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_branch_id_fkey";
ALTER TABLE "group_classes" DROP CONSTRAINT "group_classes_branch_id_fkey";
ALTER TABLE "payments" DROP CONSTRAINT "payments_branch_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT "users_branch_id_fkey";

-- AlterTable
ALTER TABLE "check_ins" DROP COLUMN "branch_id";
ALTER TABLE "equipments" DROP COLUMN "branch_id";
ALTER TABLE "group_classes" DROP COLUMN "branch_id";
ALTER TABLE "payments" DROP COLUMN "branch_id";
ALTER TABLE "users" DROP COLUMN "branch_id";

-- DropTable
DROP TABLE "gym_branches";
```

Kiểm tra: **không** có lệnh DROP/ALTER nào đụng tới bảng/cột khác ngoài 5 cột `branch_id` và bảng `gym_branches`. Nếu có (do schema lệch với DB), dừng lại và báo user.

⚠️ Migration này **xoá vĩnh viễn** dữ liệu chi nhánh. Chỉ số check-in, thiết bị, hoá đơn... vẫn giữ nguyên, chỉ mất thông tin "thuộc chi nhánh nào". Nếu DB production có dữ liệu thật, backup trước: `pg_dump -U postgres gym_db > backup_before_remove_branch.sql`.

- [ ] **Step 4: Áp dụng migration + generate client**

```bash
npx prisma migrate dev
npx prisma generate
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 5: Sửa `seed.ts`**

- Dòng 24: xoá `await prisma.gymBranch.deleteMany({});`
- Dòng 30-48: xoá log `🏛️ Tạo các chi nhánh...` và hai khối tạo `branch1`, `branch2`.
- Xoá mọi dòng `branchId: branch1.id` / `branchId: branch2.id` trong tạo `staff1`, `staff2` và 6 coach (dòng 73, 87, 103, 116, 129, 142, 155, 168).
- Dòng 300: xoá `branchId: idx % 2 === 0 ? branch1.id : branch2.id,`
- Dòng 541, 593, 619, 657: xoá các dòng `branchId: randUser.branchId` / `branchId: item.user.branchId` trong `payment.create`.
- Dòng 686-691: đổi thành

```ts
    await prisma.equipment.createMany({
        data: equipmentsData
    });
```

- Dòng 710-714: đổi thành

```ts
        await prisma.checkIn.create({
            data: {
                userId: member.id,
                checkInAt
            }
        });
```

- Dòng 776-786: xoá dòng `const coachUser = coachUsers[i % coaches.length]!;` và dòng `branchId: coachUser.branchId ?? branch1.id` trong `groupClass.create`.

Lưu ý: xoá dấu phẩy thừa ở dòng ngay trước các dòng `branchId` bị xoá nếu nó trở thành phần tử cuối (TS chấp nhận trailing comma nên không bắt buộc).

- [ ] **Step 6: Kiểm chứng compile + seed**

```bash
grep -niE "branch" prisma/schema.prisma prisma/seed.ts
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
npx prisma db seed
```

Expected: grep rỗng; không lỗi TS mới (lúc này các lỗi baseline liên quan branch nếu có cũng biến mất); seed in `🎉 Gieo hạt (Seeding) dữ liệu hoàn tất thành công!`.

- [ ] **Step 7: Kiểm tra DB thực tế**

```bash
docker exec gym-postgres psql -U postgres -d gym_db -c "\dt gym_branches" -c "SELECT table_name FROM information_schema.columns WHERE column_name='branch_id';"
```

Expected: `Did not find any relation named "gym_branches"` và truy vấn cột trả về `(0 rows)`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "refactor(db): xoá bảng gym_branches và cột branch_id"
```

---

### Task 10: Smoke test API end-to-end (thủ công)

Không có test tự động → kiểm các luồng bị ảnh hưởng bằng `curl`. Dùng tài khoản seed: `admin@gym.com` / `staff@gym.com`, mật khẩu `GymManager@123`.

- [ ] **Step 1: Chạy server**

```bash
npm run dev
```

- [ ] **Step 2: Lấy token ADMIN và STAFF**

Xem endpoint login trong `docs/auth.md` (ví dụ `POST /auth/login`), lưu vào biến:

```bash
ADMIN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@gym.com","password":"GymManager@123"}' | jq -r '.data.accessToken')
STAFF=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"staff@gym.com","password":"GymManager@123"}' | jq -r '.data.accessToken')
```

(Điều chỉnh port và đường dẫn `.data.accessToken` theo response thực tế.) Decode token tại jwt.io hoặc `echo $ADMIN | cut -d. -f2 | base64 -d` → **không** còn `branchId`.

- [ ] **Step 3: Chạy checklist** — mỗi dòng phải ra HTTP status như cột Expected:

| # | Request | Expected |
|---|---|---|
| 1 | `POST /check-in` (token ADMIN) body `{"phone":"<sđt hội viên seed>"}` — **không** có `branchId` | 200 (Review Focus #2) |
| 2 | `POST /check-in` (token STAFF) body `{"phone":"...","branchId":99}` | 200, field thừa bị bỏ qua (Review Focus #1) |
| 3 | `GET /check-in/...history` (token STAFF) | 200, thấy check-in của mọi hội viên |
| 4 | `GET /equipment/...stats` (token STAFF) | 200 |
| 5 | `POST /equipment` (token ADMIN) body không có `branchId` | 201/200, tạo được thiết bị |
| 6 | `GET /coach/...admin` (token STAFF) | 200 (trước đây có thể lỗi `STAFF_BRANCH_REQUIRED`) |
| 7 | `GET /payments/...admin` (token STAFF) | 200, thấy mọi hoá đơn |
| 8 | Xác nhận thu tiền mặt `/payments/:id/confirm...` (token STAFF) cho 1 hoá đơn `PENDING` | 200, DB `payments` status `PAID` |
| 9 | `GET /users` (token ADMIN) | 200, item **không** có `branchId`/`branch` (Review Focus #5) |
| 10 | `POST /users` (token ADMIN) tạo role `STAFF`, **không** có `branchId` | 201/200 (trước đây lỗi `BRANCH_REQUIRED_FOR_STAFF_COACH`) |
| 11 | `GET /branch` | 404 |
| 12 | Gọi 1 API bất kỳ bằng **token cũ** tạo trước Task 7 (còn `branchId`) nếu còn hạn | 200 (Review Focus #4) |

Đường dẫn chính xác của từng endpoint lấy trong `src/modules/<module>/<module>.route.ts` hoặc `docs/<module>.md`.

- [ ] **Step 4: Nếu có dòng nào fail** — dùng skill `superpowers:systematic-debugging`, sửa, commit riêng `fix(...)`.

---

### Task 11: Cập nhật tài liệu API

**Files:**
- Delete: `docs/branch.md`
- Modify: `docs/README.md:63`, `docs/check-in.md`, `docs/equipment.md`, `docs/coach.md`, `docs/payments.md`, `docs/pt-booking.md`, `docs/users.md`

- [ ] **Step 1: Xoá docs branch**

```bash
git rm docs/branch.md
```

Xoá dòng `- [Branch](./branch.md)` trong `docs/README.md`.

- [ ] **Step 2: Sửa từng file docs** — với mỗi dòng in ra bởi lệnh dưới, xoá tham số/field `branchId`, xoá mô tả "chi nhánh của STAFF", xoá mã lỗi `ADMIN_MUST_SPECIFY_BRANCH`, `STAFF_BRANCH_REQUIRED`, `BRANCH_REQUIRED_FOR_STAFF_COACH`; câu phân quyền STAFF đổi thành "STAFF xem toàn bộ dữ liệu phòng tập":

```bash
grep -n -i "branch\|chi nhánh" docs/*.md
```

- [ ] **Step 3: Kiểm chứng**

```bash
grep -rn -i "branch\|chi nhánh" docs/*.md
```

Expected: rỗng.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: bỏ tài liệu chi nhánh, cập nhật phân quyền STAFF"
```

---

### Task 12: Kiểm tra cuối & hoàn tất

- [ ] **Step 1: Kiểm tra toàn cục**

```bash
grep -rniE "branch" src prisma/schema.prisma prisma/seed.ts docs
npx tsc --noEmit -p . 2>&1 | diff - /tmp/tsc-baseline.txt
npx prisma migrate status
```

Expected: grep rỗng; không lỗi TS mới; `Database schema is up to date!`.

- [ ] **Step 2: Cập nhật frontmatter plan** — `status: Hoàn thành`, điền `completed_date`.

- [ ] **Step 3: Báo team frontend** các breaking change:
  - Bỏ endpoint `/branch/*`.
  - Bỏ `branchId` khỏi: body check-in, body tạo thiết bị, body tạo/sửa user, body xác nhận tiền mặt, query lọc ở equipment/check-in/coach/payments/users.
  - Response `/users` không còn `branchId`, `branch`.
  - JWT access token không còn `branchId`.

- [ ] **Step 4: Dùng skill `superpowers:finishing-a-development-branch`** để quyết định merge/PR.
