import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startDatabase } from './test-support/postgres';
import { migrate, seedMenu } from './database';
import type { Bill, Report } from '../src/lib/types';
async function main() {
  const t = await startDatabase();
  let count = 0;
  async function test(name: string, work: () => Promise<void>) {
    await work();
    count++;
    console.log(`PASS ${name}`);
  }
  const scalar = async (user: string, sql: string, args: unknown[] = []) =>
    t.asUser(user, async (db) => (await db.query(sql, args)).rows[0]?.result);
  const teachers = (await t.root.query("select id from products where name='Teachers'")).rows[0].id;
  const mojito = (await t.root.query("select id from products where name='Mojito'")).rows[0].id;
  const item = [{ productId: teachers, quantity: 2 }];
  const create = (key = randomUUID(), user = t.staff, items = item, payment = 'CASH') =>
    scalar(user, 'select create_bill($1,$2,$3) result', [
      key,
      payment,
      JSON.stringify(items),
    ]) as Promise<Bill>;
  let first: Bill;
  let second: Bill;
  try {
    await test('deterministic migrations and non-overwriting seed', async () => {
      await migrate(t.root);
      await seedMenu(t.root);
      assert.equal((await t.root.query('select count(*) from products')).rows[0].count, '205');
      assert.equal(
        (await t.root.query('select count(*) from products where active')).rows[0].count,
        '193',
      );
    });
    await test('metadata never grants administrator; new profiles inactive', async () => {
      const id = randomUUID();
      await t.root.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
        id,
        'attacker@example.test',
        JSON.stringify({ role: 'ADMIN', active: true }),
      ]);
      const p = (await t.root.query('select * from profiles where id=$1', [id])).rows[0];
      assert.equal(p.role, 'STAFF');
      assert.equal(p.active, false);
    });
    await test('bill saved atomically with exact price and snapshots', async () => {
      first = await create();
      assert.equal(first.billNumber, 'WAAAT-0001');
      assert.equal(first.totalPaise, '79800');
      assert.equal(first.subtotalPaise, first.totalPaise);
      assert.equal(first.items[0].unitPricePaise, '39900');
      assert.equal(first.items[0].unitLabel, '30 ml');
    });
    await test('sequential numbering and all payment methods', async () => {
      second = await create(randomUUID(), t.staff, [{ productId: mojito, quantity: 1 }], 'UPI');
      assert.equal(second.billNumber, 'WAAAT-0002');
      const card = await create(randomUUID(), t.staff, item, 'CARD');
      assert.equal(card.billNumber, 'WAAAT-0003');
    });
    await test('simultaneous retries create one bill', async () => {
      const key = randomUUID();
      const bills = await Promise.all(Array.from({ length: 12 }, () => create(key)));
      assert.equal(new Set(bills.map((b) => b.id)).size, 1);
      assert.equal(
        (await t.root.query('select count(*) from bills where idempotency_key=$1', [key])).rows[0]
          .count,
        '1',
      );
    });
    await test('concurrent distinct requests get distinct numbers', async () => {
      const bills = await Promise.all(Array.from({ length: 10 }, () => create()));
      assert.equal(new Set(bills.map((b) => b.billNumber)).size, 10);
    });
    await test('idempotency binds actor and request; canonical order is stable', async () => {
      const key = randomUUID(),
        items = [
          { productId: teachers, quantity: 1 },
          { productId: mojito, quantity: 1 },
        ];
      const a = await create(key, t.staff, items);
      const b = await create(key, t.staff, [...items].reverse());
      assert.equal(a.id, b.id);
      await assert.rejects(create(key, t.other, items), /Idempotency/);
      await assert.rejects(create(key, t.staff, items, 'CARD'), /Idempotency/);
    });
    await test('invalid requests and stale/inactive/seasonal/confirmation products rejected', async () => {
      for (const items of [
        [],
        [{ productId: teachers, quantity: 0 }],
        [{ productId: teachers, quantity: 1.5 }],
        [{ productId: teachers, quantity: 1000 }],
        [{ productId: randomUUID(), quantity: 1 }],
        [...item, ...item],
      ])
        await assert.rejects(create(randomUUID(), t.staff, items));
      await assert.rejects(create(randomUUID(), t.staff, item, 'SPLIT'));
      for (const p of (
        await t.root.query(
          'select id from products where needs_confirmation or price_paise is null',
        )
      ).rows)
        await assert.rejects(
          create(randomUUID(), t.staff, [{ productId: p.id, quantity: 1 }]),
          /unavailable/,
        );
      await t.asUser(t.admin, (db) =>
        db.query('update products set active=false where id=$1', [teachers]),
      );
      await assert.rejects(create(), /unavailable/);
      await t.asUser(t.admin, (db) =>
        db.query('update products set active=true where id=$1', [teachers]),
      );
    });
    await test('failed multi-item save leaves no partial bill or items', async () => {
      const key = randomUUID();
      await assert.rejects(
        create(key, t.staff, [
          { productId: teachers, quantity: 1 },
          { productId: randomUUID(), quantity: 1 },
        ]),
      );
      assert.equal(
        (await t.root.query('select count(*) from bills where idempotency_key=$1', [key])).rows[0]
          .count,
        '0',
      );
    });
    await test('client-supplied price and totals cannot affect SQL totals', async () => {
      const forged = [{ productId: teachers, quantity: 1, pricePaise: 1, total: 1 }];
      const bill = await create(randomUUID(), t.staff, forged);
      assert.equal(bill.totalPaise, '39900');
    });
    await test('price/name edits preserve historical receipts and create audits', async () => {
      await t.asUser(t.admin, (db) =>
        db.query("update products set price_paise=44900,name='Teachers updated' where id=$1", [
          teachers,
        ]),
      );
      const old = await scalar(t.staff, 'select bill_json($1) result', [first.id]);
      assert.equal(old.totalPaise, '79800');
      assert.equal(old.items[0].productName, 'Teachers');
      assert.equal((await create()).totalPaise, '89800');
      const audit = (
        await t.root.query(
          "select metadata from audit_logs where action='PRODUCT_PRICE_CHANGED' and entity_id=$1",
          [teachers],
        )
      ).rows[0];
      assert.equal(audit.metadata.old_price, '39900');
      assert.equal(audit.metadata.new_price, '44900');
      await seedMenu(t.root);
      assert.equal(
        (await t.root.query('select price_paise from products where id=$1', [teachers])).rows[0]
          .price_paise,
        '44900',
      );
    });
    await test('staff cannot report, void, manage users, or mutate menu/settings/profiles', async () => {
      for (const sql of [
        'select daily_report(current_date)',
        "select void_bill('" + first.id + "','wrong')",
        "select manage_user('" + t.staff + "','ADMIN',true,'hacker')",
        "update profiles set role='ADMIN' where id='" + t.staff + "'",
      ]) {
        await assert.rejects(
          t.asUser(t.staff, (db) => db.query(sql)),
          /permission|Administrator/i,
        );
      }
      assert.equal(
        (
          await t.asUser(t.staff, (db) =>
            db.query('update products set price_paise=1 where id=$1', [teachers]),
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await t.asUser(t.staff, (db) => db.query("update settings set display_name='Hacked'")))
          .rowCount,
        0,
      );
      await assert.rejects(
        t.asUser(t.staff, (db) =>
          db.query("insert into categories(name,group_type) values('Hacked','FOOD')"),
        ),
        /row-level security|Administrator/,
      );
    });
    await test('RLS isolates operational reprints and hides audit/admin data', async () => {
      assert.equal(await scalar(t.other, 'select bill_json($1) result', [first.id]), null);
      assert.equal(
        (await t.asUser(t.other, (db) => db.query('select * from bills'))).rows.length,
        0,
      );
      assert.equal(
        (await t.asUser(t.other, (db) => db.query('select * from bill_items'))).rows.length,
        0,
      );
      assert.equal(
        (await t.asUser(t.staff, (db) => db.query('select * from audit_logs'))).rows.length,
        0,
      );
      assert.equal((await scalar(t.admin, 'select bill_json($1) result', [first.id])).id, first.id);
    });
    await test('anonymous callers have no financial access', async () => {
      await assert.rejects(t.asUser(null, (db) => db.query('select * from products'), 'anon'));
      await assert.rejects(
        t.asUser(
          null,
          (db) =>
            db.query('select create_bill($1,$2,$3)', [randomUUID(), 'CASH', JSON.stringify(item)]),
          'anon',
        ),
      );
    });
    await test('immutable bills/items and append-only audit, including direct admin calls', async () => {
      for (const user of [t.staff, t.admin])
        for (const sql of [
          'delete from bills',
          'update bills set total_paise=0',
          'update bill_items set quantity=1',
          'delete from audit_logs',
        ])
          await assert.rejects(
            t.asUser(user, (db) => db.query(sql)),
            /permission/i,
          );
      await assert.rejects(t.root.query('delete from bill_items'), /immutable/);
      await assert.rejects(t.root.query('delete from bills'), /immutable/);
    });
    await test('admin void requires a reason, preserves rows, audits, never reuses number', async () => {
      await assert.rejects(
        scalar(t.admin, 'select void_bill($1,$2) result', [first.id, '  ']),
        /reason/,
      );
      const bill = await scalar(t.admin, 'select void_bill($1,$2) result', [
        first.id,
        'Wrong items entered',
      ]);
      assert.equal(bill.status, 'VOID');
      assert.equal(bill.billNumber, first.billNumber);
      assert.deepEqual(bill.items, first.items);
      await assert.rejects(
        scalar(t.admin, 'select void_bill($1,$2) result', [first.id, 'again']),
        /already void/,
      );
      const next = await create();
      assert.notEqual(next.billNumber, first.billNumber);
      assert.equal(
        (
          await t.root.query(
            "select count(*) from audit_logs where action='BILL_VOIDED' and entity_id=$1",
            [first.id],
          )
        ).rows[0].count,
        '1',
      );
    });
    await test('retry after price change, deactivation and void returns the saved result', async () => {
      const key = randomUUID(),
        bill = await create(key);
      await scalar(t.admin, 'select void_bill($1,$2) result', [bill.id, 'Correction']);
      await t.asUser(t.admin, (db) =>
        db.query('update products set active=false where id=$1', [teachers]),
      );
      const retried = await create(key);
      assert.equal(retried.id, bill.id);
      assert.equal(retried.status, 'VOID');
      await t.asUser(t.admin, (db) =>
        db.query('update products set active=true where id=$1', [teachers]),
      );
    });
    await test('reports reconcile payments and exclude VOID items', async () => {
      const date = (await t.root.query("select (now() at time zone 'Asia/Kolkata')::date::text d"))
        .rows[0].d;
      const report = (await scalar(t.admin, 'select daily_report($1) result', [date])) as Report;
      assert.equal(
        BigInt(report.completedSalesPaise),
        Object.values(report.paymentBreakdown).reduce((a, v) => a + BigInt(v), 0n),
      );
      assert.equal(report.voidCount, 2);
      assert.equal(
        report.completedBills,
        Number(
          (await t.root.query("select count(*) from bills where status='COMPLETED'")).rows[0].count,
        ),
      );
      const sold = (
        await t.root.query(
          "select sum(quantity)::text qty from bill_items i join bills b on b.id=i.bill_id where b.status='COMPLETED'",
        )
      ).rows[0].qty;
      assert.equal(
        report.topItems.reduce((n, i) => n + Number(i.quantity), 0),
        Number(sold),
      );
    });
    await test('business day includes 18:30 UTC start and excludes following 18:30 UTC end', async () => {
      // Fixture timestamps are inserted by the trusted database owner; application updates remain prohibited.
      for (const timestamp of [
        '2020-09-24T18:29:59.999Z',
        '2020-09-24T18:30:00Z',
        '2020-09-25T18:29:59.999Z',
        '2020-09-25T18:30:00Z',
      ])
        await t.root.query(
          `insert into bills(bill_number,payment_method,subtotal_paise,total_paise,created_by,idempotency_key,request_payload,business_name_snapshot,receipt_footer_snapshot,created_at) values($1,'CASH',100,100,$2,$3,'{}','Fixture','Fixture',$4)`,
          ['FIXTURE-' + randomUUID(), t.staff, randomUUID(), timestamp],
        );
      const report = await scalar(t.admin, 'select daily_report($1) result', ['2020-09-25']);
      assert.equal(report.completedBills, 2);
      assert.equal(report.completedSalesPaise, '200');
    });
    await test('allocated numbers are not reused after transaction rollback', async () => {
      let consumed = '';
      await assert.rejects(
        t.asUser(t.staff, async (db) => {
          const result = await db.query('select create_bill($1,$2,$3) result', [
            randomUUID(),
            'CASH',
            JSON.stringify(item),
          ]);
          consumed = result.rows[0].result.billNumber;
          throw new Error('Deliberate rollback after numbering');
        }),
        /Deliberate rollback/,
      );
      const next = await create();
      assert.equal(BigInt(next.billNumber.slice(6)), BigInt(consumed.slice(6)) + 1n);
    });
    await test('top products aggregate renamed snapshots by product identity', async () => {
      const date = (await t.root.query("select (now() at time zone 'Asia/Kolkata')::date::text d"))
        .rows[0].d;
      const report = (await scalar(t.admin, 'select daily_report($1) result', [date])) as Report;
      assert.equal(report.topItems.filter((p) => p.productName.startsWith('Teachers')).length, 1);
    });
    await test('deactivated users lose writes and reads with existing identity', async () => {
      await scalar(t.admin, 'select manage_user($1,$2,$3,$4) result', [
        t.other,
        'STAFF',
        false,
        'Other',
      ]);
      await assert.rejects(create(randomUUID(), t.other), /inactive/);
      assert.equal(
        (await t.asUser(t.other, (db) => db.query('select * from products'))).rowCount,
        0,
      );
    });
    await test('last administrator is protected and user role changes are audited', async () => {
      await assert.rejects(
        scalar(t.admin, 'select manage_user($1,$2,$3,$4) result', [
          t.admin,
          'STAFF',
          true,
          'Owner',
        ]),
        /at least one/,
      );
      assert.ok(
        Number(
          (await t.root.query("select count(*) from audit_logs where action='USER_ROLE_CHANGED'"))
            .rows[0].count,
        ) > 0,
      );
    });
    await test('inactive category cannot be sold', async () => {
      const category = (
        await t.root.query('select category_id from products where id=$1', [teachers])
      ).rows[0].category_id;
      await t.asUser(t.admin, (db) =>
        db.query('update categories set active=false where id=$1', [category]),
      );
      await assert.rejects(create(), /unavailable/);
    });
    await test('number formatting grows past four digits without truncation', async () => {
      await t.asUser(t.admin, (db) => db.query('update categories set active=true'));
      await t.root.query("select setval('bill_sequence',9999,true)");
      assert.equal((await create()).billNumber, 'WAAAT-10000');
    });
    console.log(
      `\n${count} PostgreSQL integration checks passed (real transactions, RLS and concurrent connections).`,
    );
  } finally {
    await t.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
